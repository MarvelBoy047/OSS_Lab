import asyncio
import json
import uuid
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List
import nbformat as nbf
from nbformat import read, write, NO_CONVERT
from jupyter_client import KernelManager
import queue
import threading
import time

class NotebookExecutor:
    def __init__(self):
        self.notebooks: Dict[str, nbf.NotebookNode] = {}
        self.failed_cells: Dict[str, List[int]] = {}
        self.kernel_manager = None
        self.kernel_client = None
        self._start_kernel()

    def _start_kernel(self):
        """Start Jupyter kernel for real execution"""
        try:
            self.kernel_manager = KernelManager()
            self.kernel_manager.start_kernel()
            self.kernel_client = self.kernel_manager.client()
            print("[NOTEBOOK] Started Jupyter kernel")
        except Exception as e:
            print(f"[NOTEBOOK] Failed to start kernel: {e}")

    def create_notebook(self, notebook_path: str) -> str:
        """Create actual Jupyter notebook file"""
        notebook_path = str(Path(notebook_path).resolve())
        
        # Create proper notebook structure
        nb = nbf.v4.new_notebook()
        nb.metadata = {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3"
            },
            "language_info": {
                "name": "python",
                "version": "3.11.0"
            }
        }
        
        # Ensure directory exists
        Path(notebook_path).parent.mkdir(parents=True, exist_ok=True)
        
        # Save to disk
        try:
            with open(notebook_path, 'w', encoding='utf-8') as f:
                write(nb, f)
            
            # Track in memory
            self.notebooks[notebook_path] = nb
            self.failed_cells[notebook_path] = []
            
            print(f"[NOTEBOOK] Created notebook: {notebook_path}")
            return notebook_path
            
        except Exception as e:
            print(f"[NOTEBOOK] Error creating notebook: {e}")
            return ""

    def add_markdown_cell(self, notebook_path: str, content: str) -> bool:
        """Add markdown cell to notebook"""
        try:
            notebook_path = str(Path(notebook_path).resolve())
            
            # Load notebook if not in memory
            if notebook_path not in self.notebooks:
                self._load_notebook(notebook_path)
            
            nb = self.notebooks[notebook_path]
            
            # Create new markdown cell
            cell = nbf.v4.new_markdown_cell(content)
            nb.cells.append(cell)
            
            # Save to disk immediately
            self._save_notebook(notebook_path)
            
            print(f"[NOTEBOOK] Added markdown cell to {Path(notebook_path).name}")
            return True
            
        except Exception as e:
            print(f"[NOTEBOOK] Error adding markdown cell: {e}")
            return False

    def add_code_cell(self, notebook_path: str, code: str, cell_number: int) -> str:
        """Add code cell to notebook and return cell ID"""
        try:
            notebook_path = str(Path(notebook_path).resolve())
            cell_id = str(uuid.uuid4())[:8]
            
            # Load notebook if not in memory
            if notebook_path not in self.notebooks:
                self._load_notebook(notebook_path)
            
            nb = self.notebooks[notebook_path]
            
            # Create new code cell
            cell = nbf.v4.new_code_cell(code)
            cell.execution_count = cell_number
            cell.id = cell_id
            
            # Add to notebook
            nb.cells.append(cell)
            
            # Save to disk immediately
            self._save_notebook(notebook_path)
            
            print(f"[NOTEBOOK] Added code cell #{cell_number} to {Path(notebook_path).name}")
            return cell_id
            
        except Exception as e:
            print(f"[NOTEBOOK] Error adding code cell: {e}")
            return ""

    async def execute_code_cell(self, notebook_path: str, code: str, cell_number: int) -> Dict[str, Any]:
        """Execute code cell in Jupyter kernel"""
        notebook_path = str(Path(notebook_path).resolve())
        
        # Add cell to notebook first
        cell_id = self.add_code_cell(notebook_path, code, cell_number)
        
        if not cell_id:
            return {"success": False, "error": "Failed to add cell to notebook", "cell_id": ""}

        try:
            # Execute in kernel
            if not self.kernel_client:
                return {"success": False, "error": "Kernel not available", "cell_id": cell_id}

            # Send code to kernel
            msg_id = self.kernel_client.execute(code)
            
            # Collect outputs
            timeout = 30
            outputs = []
            error_outputs = []
            start_time = time.time()
            
            while time.time() - start_time < timeout:
                try:
                    msg = self.kernel_client.get_iopub_msg(timeout=1)
                    
                    if msg['parent_header'].get('msg_id') == msg_id:
                        msg_type = msg['msg_type']
                        content = msg['content']
                        
                        if msg_type == 'stream':
                            outputs.append(content['text'])
                        elif msg_type == 'execute_result':
                            outputs.append(content['data'].get('text/plain', ''))
                        elif msg_type == 'display_data':
                            # Handle plots/images
                            outputs.append("Display data generated")
                        elif msg_type == 'error':
                            error_outputs.append(f"{content['ename']}: {content['evalue']}")
                        elif msg_type == 'status' and content['execution_state'] == 'idle':
                            break
                            
                except queue.Empty:
                    continue
                except Exception as e:
                    break

            # Update notebook with results
            self._update_cell_output(notebook_path, cell_id, outputs, error_outputs)

            if error_outputs:
                return {
                    "success": False,
                    "error": '\n'.join(error_outputs),
                    "output": "",
                    "stderr": '\n'.join(error_outputs),
                    "cell_id": cell_id
                }
            else:
                return {
                    "success": True,
                    "output": '\n'.join(outputs),
                    "stderr": "",
                    "cell_id": cell_id,
                    "is_graph": any(keyword in code.lower() for keyword in ['plt.', 'matplotlib', 'seaborn', 'sns.'])
                }
                
        except Exception as e:
            print(f"[NOTEBOOK] Execution error: {e}")
            return {
                "success": False,
                "error": str(e),
                "output": "",
                "stderr": str(e),
                "cell_id": cell_id
            }

    def _load_notebook(self, notebook_path: str) -> bool:
        """Load notebook from disk into memory"""
        try:
            notebook_path = str(Path(notebook_path).resolve())
            
            if Path(notebook_path).exists():
                with open(notebook_path, 'r', encoding='utf-8') as f:
                    self.notebooks[notebook_path] = read(f, as_version=NO_CONVERT)
                if notebook_path not in self.failed_cells:
                    self.failed_cells[notebook_path] = []
                return True
            else:
                print(f"[NOTEBOOK] Notebook file not found: {notebook_path}")
                return False
                
        except Exception as e:
            print(f"[NOTEBOOK] Error loading notebook: {e}")
            return False

    def _save_notebook(self, notebook_path: str):
        """Save notebook from memory to disk"""
        try:
            notebook_path = str(Path(notebook_path).resolve())
            
            if notebook_path in self.notebooks:
                with open(notebook_path, 'w', encoding='utf-8') as f:
                    write(self.notebooks[notebook_path], f)
            else:
                print(f"[NOTEBOOK] Notebook not found in memory: {notebook_path}")
                
        except Exception as e:
            print(f"[NOTEBOOK] Error saving notebook: {e}")

    def _update_cell_output(self, notebook_path: str, cell_id: str, outputs: List[str], errors: List[str]):
        """Update cell output in notebook"""
        try:
            notebook_path = str(Path(notebook_path).resolve())
            
            if notebook_path in self.notebooks:
                nb = self.notebooks[notebook_path]
                
                # Find and update the cell
                for cell in nb.cells:
                    if hasattr(cell, 'id') and cell.id == cell_id and cell.cell_type == 'code':
                        # Clear existing outputs
                        cell.outputs = []
                        
                        # Add outputs
                        if outputs:
                            for output in outputs:
                                if output.strip():
                                    cell.outputs.append(nbf.v4.new_output(
                                        output_type='stream',
                                        name='stdout',
                                        text=output
                                    ))
                        
                        # Add errors
                        if errors:
                            for error in errors:
                                cell.outputs.append(nbf.v4.new_output(
                                    output_type='stream',
                                    name='stderr',
                                    text=error
                                ))
                        break
                
                # Save updated notebook
                self._save_notebook(notebook_path)
                
        except Exception as e:
            print(f"[NOTEBOOK] Error updating cell output: {e}")

    def get_notebook_summary(self, notebook_path: str) -> Dict[str, Any]:
        """Get summary of notebook contents"""
        try:
            notebook_path = str(Path(notebook_path).resolve())
            
            if notebook_path not in self.notebooks:
                self._load_notebook(notebook_path)
            
            if notebook_path in self.notebooks:
                nb = self.notebooks[notebook_path]
                
                return {
                    "total_cells": len(nb.cells),
                    "code_cells": len([c for c in nb.cells if c.cell_type == "code"]),
                    "markdown_cells": len([c for c in nb.cells if c.cell_type == "markdown"]),
                    "failed_cells": len(self.failed_cells.get(notebook_path, [])),
                    "notebook_path": notebook_path
                }
            else:
                return {"error": "Notebook not found"}
                
        except Exception as e:
            return {"error": str(e)}

    def shutdown(self):
        """Clean shutdown of Jupyter kernel"""
        try:
            if self.kernel_client:
                self.kernel_client.stop_channels()
            if self.kernel_manager:
                self.kernel_manager.shutdown_kernel()
            print("[NOTEBOOK] Jupyter kernel shut down")
        except Exception as e:
            print(f"[NOTEBOOK] Error shutting down kernel: {e}")

    def __del__(self):
        """Cleanup on deletion"""
        self.shutdown()

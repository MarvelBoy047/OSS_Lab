#!/usr/bin/env python3
"""
OSS Lab Backend Testing Script - Fixed Version
Tests the backend functionality without dataset upload API
"""

import requests
import json
import time
import sys
import os
import tempfile
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any

# Configuration
API_BASE = "http://localhost:8000"
YOUR_API_KEY = "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"  # Replace with your actual key

class OSSLabTester:
    def __init__(self):
        self.chat_id: Optional[str] = None
        self.test_results = []
        self.passed_tests = 0
        self.total_tests = 0

    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result with status"""
        self.total_tests += 1
        if success:
            self.passed_tests += 1
            status = "✅ PASS"
        else:
            status = "❌ FAIL"
            
        print(f"{status} | {test_name}")
        if details:
            print(f"    → {details}")
            
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def create_test_dataset(self) -> Optional[str]:
        """Create a test CSV dataset in a temporary location"""
        try:
            data = {
                'employee_id': range(1, 101),
                'name': [f'Employee_{i}' for i in range(1, 101)],
                'age': [25 + (i % 40) for i in range(1, 101)],
                'salary': [40000 + (i * 500) for i in range(1, 101)],
                'department': ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'] * 20,
                'experience_years': [i % 15 for i in range(1, 101)]
            }
            
            df = pd.DataFrame(data)
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
            df.to_csv(temp_file.name, index=False)
            temp_file.close()
            
            print(f"📊 Test dataset created: {temp_file.name}")
            return temp_file.name
            
        except Exception as e:
            print(f"❌ Failed to create test dataset: {e}")
            return None

    def test_server_health(self) -> bool:
        """Test if backend server is running and healthy"""
        print("\n🔌 Testing Server Health...")
        try:
            response = requests.get(f"{API_BASE}/api/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.log_test("Server Health Check", True, f"Status: {data.get('status', 'unknown')}")
                return True
            else:
                self.log_test("Server Health Check", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Server Health Check", False, f"Connection failed: {e}")
            return False

    def test_settings_configuration(self) -> bool:
        """Test API key configuration"""
        print("\n⚙️ Testing Settings Configuration...")
        try:
            settings_data = {
                "api_key": YOUR_API_KEY,
                "model": "openai/gpt-oss-120b",
                "temperature": 0.7,
                "top_p": 0.9
            }
            
            response = requests.post(f"{API_BASE}/api/settings", json=settings_data)
            if response.status_code == 200:
                result = response.json()
                self.log_test("Settings Update", True, f"Updated: {result.get('updated_fields', [])}")
                
                get_response = requests.get(f"{API_BASE}/api/settings")
                if get_response.status_code == 200:
                    settings = get_response.json()
                    api_valid = settings.get('api_key_valid', False)
                    self.log_test("API Key Validation", api_valid, f"API Key Valid: {api_valid}")
                    return api_valid
                else:
                    self.log_test("Settings Retrieval", False, f"HTTP {get_response.status_code}")
                    return False
            else:
                self.log_test("Settings Update", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Settings Configuration", False, f"Request failed: {e}")
            return False

    def test_chat_creation(self) -> bool:
        """Test creating a new chat session"""
        print("\n💬 Testing Chat Creation...")
        try:
            response = requests.post(f"{API_BASE}/api/chat/create")
            if response.status_code == 200:
                data = response.json()
                self.chat_id = data.get('chat_id')
                self.log_test("Chat Creation", True, f"Chat ID: {self.chat_id}")
                return True
            else:
                self.log_test("Chat Creation", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Chat Creation", False, f"Request failed: {e}")
            return False

    def send_message(self, message: str) -> Optional[Dict[str, Any]]:
        """Send a message to the chat and return response"""
        if not self.chat_id:
            return None
            
        try:
            payload = {
                "chat_id": self.chat_id,
                "message": message,
                "web_search_enabled": False
            }
            
            response = requests.post(f"{API_BASE}/api/chat", json=payload, timeout=60)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"    Failed to send message: HTTP {response.status_code}")
                return None
                
        except Exception as e:
            print(f"    Exception sending message: {e}")
            return None

    def test_basic_chat(self) -> bool:
        """Test basic chat functionality with improved response parsing"""
        print("\n💭 Testing Basic Chat...")
        if not self.chat_id:
            self.log_test("Basic Chat", False, "No chat ID available")
            return False
            
        response = self.send_message("Hello! Please introduce yourself as OSS_Labs.")
        if response:
            response_type = response.get('response_type', 'unknown')
            
            # Handle different message field types
            message_field = response.get('message')
            if isinstance(message_field, dict):
                message_content = message_field.get('content', '')
            elif isinstance(message_field, str):
                message_content = message_field
            else:
                message_content = str(message_field) if message_field else ''
            
            if response_type == 'text':
                success = 'OSS_Labs' in message_content or 'OSS' in message_content
                self.log_test("Basic Chat", success, f"Response type: {response_type}")
                return success
            else:
                self.log_test("Basic Chat", False, f"Unexpected response type: {response_type}")
                return False
        else:
            self.log_test("Basic Chat", False, "No response received")
            return False

    def test_metadata_analysis_explicit_path(self, dataset_path: str) -> bool:
        """Test metadata analysis with explicit dataset path in message"""
        print("\n🔍 Testing Metadata Analysis (Explicit Path)...")
        if not self.chat_id:
            self.log_test("Metadata Analysis", False, "No chat ID available")
            return False
            
        message = f"Please analyze the metadata of the dataset located at: {dataset_path}"
        response = self.send_message(message)
        
        if response:
            response_type = response.get('response_type', 'unknown')
            print(f"    Response type: {response_type}")
            
            if response_type in ['tool_call', 'tool']:
                tool_call = response.get('tool_call', '')
                agent_result = response.get('agent_result', '')
                
                # Handle agent_result being either string or dict
                if isinstance(agent_result, dict):
                    agent_text = agent_result.get('content', str(agent_result))
                else:
                    agent_text = str(agent_result) if agent_result else ''
                
                metadata_triggered = ('metadata' in tool_call.lower() if tool_call else False)
                analysis_success = any(keyword in agent_text.lower() 
                                     for keyword in ['shape', 'columns', 'dataset', 'analysis'])
                
                success = metadata_triggered or analysis_success
                details = f"Tool: {metadata_triggered}, Analysis: {analysis_success}"
                self.log_test("Metadata Analysis", success, details)
                return success
            else:
                self.log_test("Metadata Analysis", False, f"Expected tool call, got: {response_type}")
                return False
        else:
            self.log_test("Metadata Analysis", False, "No response received")
            return False

    def test_conversations_list(self) -> bool:
        """Test listing conversations"""
        print("\n📋 Testing Conversations List...")
        try:
            response = requests.get(f"{API_BASE}/api/conversations")
            if response.status_code == 200:
                data = response.json()
                conversations = data.get('conversations', [])
                total_experiments = data.get('total_experiments', 0)
                
                self.log_test("Conversations List", True, 
                             f"Conversations: {len(conversations)}, Experiments: {total_experiments}")
                return True
            else:
                self.log_test("Conversations List", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Conversations List", False, f"Request failed: {e}")
            return False

    def run_full_test_suite(self):
        """Run the complete test suite"""
        print("🚀 OSS Lab Backend Test Suite - Fixed Version")
        print("=" * 60)
        
        start_time = time.time()
        dataset_path = None
        
        if not self.test_server_health():
            return self.generate_report()
        
        if not self.test_settings_configuration():
            return self.generate_report()
        
        if not self.test_chat_creation():
            return self.generate_report()
        
        self.test_basic_chat()
        
        dataset_path = self.create_test_dataset()
        if dataset_path:
            self.test_metadata_analysis_explicit_path(dataset_path)
        
        self.test_conversations_list()
        
        # Cleanup
        if dataset_path and os.path.exists(dataset_path):
            try:
                os.unlink(dataset_path)
                print(f"\n🧹 Cleaned up test dataset: {dataset_path}")
            except Exception as e:
                print(f"\n⚠️ Could not clean up dataset: {e}")
        
        end_time = time.time()
        duration = end_time - start_time
        
        return self.generate_report(duration)

    def generate_report(self, duration: float = 0):
        """Generate comprehensive test report"""
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        print(f"✅ Tests Passed: {self.passed_tests}/{self.total_tests}")
        print(f"❌ Tests Failed: {self.total_tests - self.passed_tests}/{self.total_tests}")
        
        if duration > 0:
            print(f"⏱️ Total Duration: {duration:.2f} seconds")
            
        pass_rate = (self.passed_tests / self.total_tests * 100) if self.total_tests > 0 else 0
        print(f"📈 Pass Rate: {pass_rate:.1f}%")
        
        if self.chat_id:
            print(f"💬 Test Chat ID: {self.chat_id}")
        
        failed_tests = [test for test in self.test_results if not test['success']]
        if failed_tests:
            print("\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"   - {test['test']}: {test['details']}")
        
        print("\n" + "=" * 60)
        if pass_rate >= 90:
            print("🎉 OVERALL STATUS: EXCELLENT!")
        elif pass_rate >= 80:
            print("🎉 OVERALL STATUS: GOOD!")
        elif pass_rate >= 60:
            print("⚠️ OVERALL STATUS: OK!")
        else:
            print("❌ OVERALL STATUS: NEEDS WORK!")
            
        return pass_rate >= 60

def main():
    print("🔧 Starting Fixed OSS Lab Backend Tests...")
    print("⚠️ Ensure backend server is running: 'python main.py'")
    time.sleep(2)

    tester = OSSLabTester()
    success = tester.run_full_test_suite()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

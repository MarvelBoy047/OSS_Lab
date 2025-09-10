import os

base_directory = r"C:\Users\Aniket\Downloads\OSS_Lab\OSS_UI"
output_txt_file = os.path.join(base_directory, 'OSS_LAB_all_code.txt')

relevant_extensions = {'.ts', '.tsx', '.js', '.jsx', '.json', '.jsonc', '.toml', '.py', }
exclude_dirs = {'node_modules', 'images', 'svg', '.git','data','docs','.next','.vscode','.sql'}
exclude_extensions = {'.md', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico','.svg','.ico','.lock','.zip','.tar','.gz','.sh','.json'}

collected_lines = []

for root, dirs, files in os.walk(base_directory):
    # Skip unwanted directories
    dirs[:] = [d for d in dirs if d not in exclude_dirs]

    for file in files:
        ext = os.path.splitext(file)[1].lower()
        if ext in relevant_extensions and ext not in exclude_extensions:
            try:
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                # Add file separator for readability
                collected_lines.append(f"\n// ==== File: {file_path} ====\n")
                collected_lines.append(content)
            except Exception as e:
                collected_lines.append(f"\n// ==== Failed to read {file_path} due to {e} ====\n")

with open(output_txt_file, 'w', encoding='utf-8') as out_file:
    out_file.write('\n'.join(collected_lines))

print(f"Code files concatenated and saved to {output_txt_file}")

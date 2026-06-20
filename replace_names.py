import os

directory = '/Users/tutul/Downloads/antirug'
extensions = ['.js', '.json', '.md', '.py', '.ts', '.html', '.css', '.jsx', '.tsx']

def replace_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
        return
    
    # Simple replacements
    new_content = content.replace('AntiRug', 'AntiRug')
    new_content = new_content.replace('antirug', 'antirug')
    new_content = new_content.replace('ANTIRUG', 'ANTIRUG')
    
    if new_content != content:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated: {filepath}")
        except Exception as e:
            print(f"Failed to write {filepath}: {e}")

for root, _, files in os.walk(directory):
    if 'node_modules' in root or '.git' in root or 'dist' in root:
        continue
    for file in files:
        if any(file.endswith(ext) for ext in extensions):
            replace_in_file(os.path.join(root, file))

# Also do it for artifacts
artifacts_dir = '/Users/tutul/.gemini/antigravity/brain/765eef79-b320-4300-9e0b-88c2f80eda5e'
for root, _, files in os.walk(artifacts_dir):
    for file in files:
        if file.endswith('.md'):
            replace_in_file(os.path.join(root, file))

print("Done.")

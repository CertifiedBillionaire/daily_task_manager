#list_folders_clean.py

import os

# --- SETTINGS ---
# The folder you want to list. Use '.' for the current directory.
root_directory = '.'

# The name of the output file.
output_filename = 'my_clean_file_list.txt'

# Add any FOLDER names you want to completely ignore here.
# For example, 'node_modules' for web projects.
folders_to_ignore = {'.git', '__pycache__', 'venv'} 

# Add any FILE names you want to ignore here.
files_to_ignore = {'.DS_Store'}
# --- END OF SETTINGS ---


def generate_clean_folder_tree(directory, output_file):
    """Walks through a directory and writes a CLEAN structure to a file, ignoring specified items."""

    # Add the script's own output file to the ignore list automatically
    files_to_ignore.add(output_file)

    print(f"Starting to list directory: {os.path.abspath(directory)}")

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"Clean directory listing for: {os.path.abspath(directory)}\n")
        f.write("=" * 40 + "\n\n")

        for root, dirs, files in os.walk(directory, topdown=True):
            # --- FILTERING LOGIC ---
            # 1. Filter out ignored folders IN-PLACE so os.walk doesn't even enter them.
            dirs[:] = [d for d in dirs if d not in folders_to_ignore and not d.startswith('.')]

            # 2. Filter out ignored files.
            files = [file for file in files if file not in files_to_ignore and not file.startswith('.')]
            # --- END OF FILTERING ---

            level = root.replace(directory, '').count(os.sep)
            indent = ' ' * 4 * level

            f.write(f"{indent}📂 {os.path.basename(root)}/\n")

            sub_indent = ' ' * 4 * (level + 1)
            for file_name in sorted(files):
                f.write(f"{sub_indent}📄 {file_name}\n")

            # Sort directories for a consistent output
            dirs.sort()

    print(f"Success! Clean folder structure saved to '{output_filename}'")

# Run the function
generate_clean_folder_tree(root_directory, output_filename)
# My Custom Sidebar - Firefox Extension

A beautiful Firefox sidebar extension that gives you quick access to your favorite websites in a sleek, dark-themed panel.

![Firefox](https://img.shields.io/badge/Firefox-Extension-FF7139?logo=firefox-browser&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

## Features

- **Quick Access Sidebar** - Access your favorite sites without leaving your current tab
- **Auto Favicon Fetching** - Automatically fetches and caches website icons
- **Add/Edit/Delete Sites** - Full CRUD operations for managing your sites
- **Import/Export** - Backup and restore your sites as JSON
- **Loading Indicator** - Visual feedback while sites load
- **Refresh & Open in Tab** - Toolbar controls for the embedded iframe
- **Beautiful Dark Theme** - Modern, eye-friendly dark UI
- **Persistent Storage** - Your sites are saved locally

## Screenshots

```
┌─────────────────────────────────┐
│ [C] [Y] [W] [G] [T] [Cl] [Ge]   │  <- Site icons
│ ─────────────────────────────── │
│ [+] [📤] [📥]                   │  <- Add, Export, Import
├─────────────────────────────────┤
│ [↻] [↗]              Loading... │  <- Toolbar
├─────────────────────────────────┤
│                                 │
│         Website Content         │  <- iframe
│                                 │
└─────────────────────────────────┘
```

## Installation

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/my-sidebar-ext.git
   ```

2. Open Firefox and go to `about:debugging`

3. Click "This Firefox" in the left sidebar

4. Click "Load Temporary Add-on"

5. Navigate to the cloned folder and select `manifest.json`

6. The sidebar will now be available! Click the sidebar icon or press `Ctrl+B` to toggle it.

### From Firefox Add-ons (Coming Soon)

The extension will be available on Firefox Add-ons store soon.

## Usage

### Adding a Site
1. Click the `+` button in the sidebar
2. Enter the site name and URL
3. Optionally choose a fallback color (used if favicon can't be loaded)
4. Click "Save"

### Editing a Site
1. Right-click on any site icon
2. Select "Edit" from the context menu
3. Modify the details and save

### Deleting a Site
1. Right-click on any site icon
2. Select "Delete" from the context menu

### Export Sites
1. Click the 📤 (export) button
2. A JSON file will be downloaded with all your sites

### Import Sites
1. Click the 📥 (import) button
2. Select a previously exported JSON file
3. Choose to replace or merge with existing sites

## Default Sites

The extension comes with these default sites:
- ChatGPT
- YouTube
- WhatsApp Web
- GitHub
- Google Translate
- Claude AI
- Gemini

## Technical Details

- **Manifest Version**: 2
- **Permissions**: 
  - `webRequest` & `webRequestBlocking` - For removing X-Frame-Options headers
  - `storage` - For saving sites locally
  - `<all_urls>` - For loading any website in the iframe

### How iframe embedding works

Many websites block being embedded in iframes using `X-Frame-Options` or `Content-Security-Policy` headers. This extension uses a background script to strip these headers, allowing most sites to load in the sidebar.

> ⚠️ **Note**: Some sites may still not work due to JavaScript-based frame detection.

## File Structure

```
my-sidebar-ext/
├── manifest.json      # Extension manifest
├── background.js      # Header stripping logic
├── sidebar.html       # Sidebar UI structure
├── sidebar.css        # Styles
├── sidebar.js         # Main application logic
├── README.md          # This file
└── LICENSE            # MIT License
```

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Made with ❤️ by [Your Name]

---

⭐ If you find this extension useful, please star the repository!


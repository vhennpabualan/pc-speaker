# PC Speaker desktop app

## Run during development

From this folder:

```powershell
npm start
```

The app opens the hosted PC Speaker `/send` page in its own window. Click **Share system audio** to start capture.

Closing the window keeps PC Speaker in the Windows system tray. Use **Show PC Speaker** or double-click the tray icon to reopen it, and use **Quit** to exit completely.

The app sizes its initial window to the available display area and tightens page spacing on shorter windows. New device approval requests appear as a focused modal dialog.

Launching PC Speaker again while it is already running brings the existing window to the front. The app shows an offline retry page if the hosted `/send` page cannot load within 15 seconds.

## Build the Windows installer

From this folder:

```powershell
npm run dist
```

The NSIS x64 installer is written to `dist/`. Run the `.exe` installer, then launch **PC Speaker** from the Start menu or desktop shortcut.

To uninstall, use Windows **Settings > Apps > Installed apps**, find **PC Speaker**, and select **Uninstall**. You can also run `dist/`'s installer and choose uninstall if Windows provides that option.

## Troubleshooting

- If `/send` does not load, check your internet connection and confirm `https://pc-speaker.vercel.app/send` is reachable.
- If the window is hidden, reopen it from the PC Speaker tray icon or launch the app again.
- If no sharing starts, confirm Windows has allowed screen capture and audio loopback for Electron.
- If the page is replaced by the offline screen, click **Retry** after internet is restored.
- For a clean rebuild, delete `dist/` and run `npm run dist` again.

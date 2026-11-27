# PC Speaker desktop app

## Run during development

From this folder:

```powershell
npm start
```

The app opens the hosted PC Speaker `/send` page in its own window. Click **Share system audio** to start capture.

## Build the Windows installer

From this folder:

```powershell
npm run dist
```

The NSIS x64 installer is written to `dist/`. Run the `.exe` installer, then launch **PC Speaker** from the Start menu or desktop shortcut.

To uninstall, use Windows **Settings > Apps > Installed apps**, find **PC Speaker**, and select **Uninstall**. You can also run `dist/`'s installer and choose uninstall if Windows provides that option.

## Troubleshooting

- If `/send` does not load, check your internet connection and confirm `https://pc-speaker.vercel.app/send` is reachable.
- If no sharing starts, confirm Windows has allowed screen capture and audio loopback for Electron.
- If the page is replaced by the offline screen, click **Retry** after internet is restored.
- For a clean rebuild, delete `dist/` and run `npm run dist` again.

const { AttachmentBuilder } = require('discord.js')
const axios = require('axios')
const { execFile } = require('child_process')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const { PNG } = require('pngjs')
const { promisify } = require('util')

const execFileAsync = promisify(execFile)
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant'
const SCREENSHOT_DELAY_MS = Number.parseInt(process.env.PC_SCREENSHOT_DELAY_MS, 10) || 3000
let lastBrowserSearch = null

const DANGEROUS_PATTERNS = [
    /\b(del|delete|remove|erase|format|wipe|reset)\b/i,
    /\b(shutdown|logoff|sign\s*out)\b/i,
    /\b(regedit|registry|taskkill|kill\s+process|stop\s+process)\b/i,
    /\b(powershell|shell|bat|ps1|script)\b/i,
    /\b(download|uninstall|update\s+driver)\b/i,
    /\b(password|token|secret|cookie|credential)\b/i
]

const APP_ALIASES = {
    chrome: 'chrome',
    google: 'chrome',
    browser: 'chrome',
    edge: 'msedge',
    'microsoft edge': 'msedge',
    'ms edge': 'msedge',
    notepad: 'notepad',
    calculator: 'calc',
    calc: 'calc',
    paint: 'mspaint',
    explorer: 'explorer',
    vscode: 'code',
    'vs code': 'code',
    blender: 'blender',
    discord: 'discord',
    spotify: 'spotify',
    cmd: 'cmd',
    'command prompt': 'cmd',
    terminal: 'wt'
}

const APP_PROCESS_NAMES = {
    chrome: ['chrome'],
    msedge: ['msedge'],
    notepad: ['notepad'],
    calc: ['CalculatorApp', 'calc'],
    mspaint: ['mspaint'],
    explorer: ['explorer'],
    code: ['Code'],
    blender: ['blender'],
    discord: ['Discord'],
    spotify: ['Spotify'],
    cmd: ['cmd'],
    wt: ['WindowsTerminal']
}

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const inferBrowser = (value, fallback = 'chrome') => {
    const text = cleanText(value).toLowerCase()
    if (/\b(microsoft\s+edge|ms\s+edge|edge)\b/.test(text)) return 'msedge'
    if (/\b(chrome|google\s+chrome|browser)\b/.test(text)) return 'chrome'
    return fallback
}

const browserLabel = (browser) => browser === 'msedge' ? 'Microsoft Edge' : 'Chrome'

const MCP_TOOL_DEFINITIONS = [
    {
        name: 'open_app',
        description: 'Open a safe installed app.',
        arguments: { app: 'chrome | edge | notepad | calculator | paint | explorer | vscode | blender | discord | spotify | cmd | terminal' }
    },
    {
        name: 'close_app',
        description: 'Close a safe whitelisted desktop app by sending its main window a close request.',
        arguments: { app: 'chrome | edge | notepad | calculator | paint | explorer | vscode | blender | discord | spotify | cmd | terminal' }
    },
    {
        name: 'open_url',
        description: 'Open a website URL in Chrome or Microsoft Edge.',
        arguments: { url: 'https://example.com', browser: 'chrome | msedge' }
    },
    {
        name: 'search_web',
        description: 'Search Google in Chrome or Microsoft Edge.',
        arguments: { query: 'search text', browser: 'chrome | msedge', open_first_result: false }
    },
    {
        name: 'click_first_link',
        description: 'Focus Chrome or Microsoft Edge and open the first visible search result/link.',
        arguments: { browser: 'chrome | msedge' }
    },
    {
        name: 'type_text',
        description: 'Paste/type text into the currently focused window, optionally pressing Enter after it.',
        arguments: { text: 'text to type', press_enter: false }
    },
    {
        name: 'press_key',
        description: 'Press safe keyboard keys in the focused window.',
        arguments: { key: 'enter | tab | escape | backspace | space | up | down | left | right | ctrl+l', times: 1 }
    },
    {
        name: 'mouse_click',
        description: 'Move the mouse to screen coordinates and click.',
        arguments: { x: 500, y: 350, button: 'left | right', clicks: 1 }
    },
    {
        name: 'refresh_desktop',
        description: 'Refresh the Windows desktop.',
        arguments: {}
    },
    {
        name: 'screenshot',
        description: 'Capture the current screen.',
        arguments: {}
    }
]

const isAuthorized = (client, userId) => {
    const allowed = [
        ...(client.config.owner || []),
        ...(client.config.developer || []),
        ...(client.config.admin || [])
    ].map(String)

    return allowed.includes(String(userId))
}

const isDangerous = (text) => DANGEROUS_PATTERNS.some((pattern) => pattern.test(text))

const psEscape = (value) => String(value).replace(/'/g, "''")

const runPowerShell = async (command, timeout = 15000) => {
    return execFileAsync('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        command
    ], {
        windowsHide: true,
        timeout
    })
}

const cmdEscape = (value) => String(value || '').replace(/"/g, '""')

const runCmdStart = async (target, args = [], timeout = 10000) => {
    const command = [
        'start',
        '""',
        `"${cmdEscape(target)}"`,
        ...args.map((arg) => `"${cmdEscape(arg)}"`)
    ].join(' ')

    return execFileAsync('cmd.exe', ['/d', '/s', '/c', command], {
        windowsHide: true,
        timeout
    })
}

const exists = async (file) => {
    try {
        await fs.access(file)
        return true
    } catch {
        return false
    }
}

const launchExecutable = async (file, args = [], timeout = 10000) => {
    return execFileAsync(file, args, {
        windowsHide: true,
        timeout
    })
}

const findBlenderExecutable = async () => {
    const envPath = process.env.PC_APP_BLENDER
    if (envPath && await exists(envPath)) return envPath

    const roots = [
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Blender Foundation'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Blender Foundation')
    ]

    for (const root of roots) {
        try {
            const entries = await fs.readdir(root, { withFileTypes: true })
            const dirs = entries
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name)
                .sort()
                .reverse()

            for (const dir of dirs) {
                const candidate = path.join(root, dir, 'blender.exe')
                if (await exists(candidate)) return candidate
            }
        } catch {
            // Folder does not exist on many installs.
        }
    }

    return null
}

const openWhitelistedApp = async (app) => {
    const envPath = process.env[`PC_APP_${String(app).toUpperCase()}`]
    if (envPath && await exists(envPath)) {
        await launchExecutable(envPath)
        return
    }

    if (app === 'spotify') {
        await runCmdStart('spotify:', [], 10000)
        return
    }

    if (app === 'discord') {
        try {
            await runCmdStart('discord://-/', [], 10000)
            return
        } catch {
            const updatePath = path.join(process.env.LOCALAPPDATA || '', 'Discord', 'Update.exe')
            if (await exists(updatePath)) {
                await launchExecutable(updatePath, ['--processStart', 'Discord.exe'])
                return
            }
        }
    }

    if (app === 'blender') {
        try {
            await runCmdStart('blender', [], 10000)
            return
        } catch {
            const blenderPath = await findBlenderExecutable()
            if (blenderPath) {
                await launchExecutable(blenderPath)
                return
            }
        }
    }

    await runCmdStart(app, [], 10000)
}

const closeWhitelistedApp = async (app) => {
    const processNames = APP_PROCESS_NAMES[app]
    if (!processNames?.length) throw new Error('That app cannot be closed by !pc.')

    const psNames = processNames.map((name) => `'${psEscape(name)}'`).join(',')
    const ps = [
        `$names = @(${psNames})`,
        '$closed = 0',
        'foreach ($name in $names) {',
        '  Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {',
        '    if ($_.MainWindowHandle -ne 0) {',
        '      if ($_.CloseMainWindow()) { $script:closed++ }',
        '    }',
        '  }',
        '}',
        'if ($closed -eq 0) { throw "No open app window found to close." }'
    ].join('; ')

    await runPowerShell(ps, 10000)
}

const KEY_MAP = {
    enter: '{ENTER}',
    tab: '{TAB}',
    escape: '{ESC}',
    esc: '{ESC}',
    backspace: '{BACKSPACE}',
    space: ' ',
    up: '{UP}',
    down: '{DOWN}',
    left: '{LEFT}',
    right: '{RIGHT}',
    home: '{HOME}',
    end: '{END}',
    'ctrl+l': '^l',
    'ctrl+a': '^a',
    'ctrl+c': '^c',
    'ctrl+v': '^v'
}

const pressKeyboardKey = async (key, times = 1) => {
    const normalized = cleanText(key).toLowerCase()
    const mapped = KEY_MAP[normalized]
    const count = Math.min(Math.max(Number.parseInt(times, 10) || 1, 1), 20)
    if (!mapped) throw new Error('That key is not allowed.')

    const ps = [
        '$wshell = New-Object -ComObject WScript.Shell',
        `for ($i = 0; $i -lt ${count}; $i++) { $wshell.SendKeys('${psEscape(mapped)}'); Start-Sleep -Milliseconds 80 }`
    ].join('; ')

    await runPowerShell(ps, 10000)
}

const clickMouse = async (x, y, button = 'left', clicks = 1) => {
    const safeX = Math.round(Number(x))
    const safeY = Math.round(Number(y))
    const safeClicks = Math.min(Math.max(Number.parseInt(clicks, 10) || 1, 1), 3)
    const isRight = cleanText(button).toLowerCase() === 'right'
    if (!Number.isFinite(safeX) || !Number.isFinite(safeY) || safeX < 0 || safeY < 0) {
        throw new Error('Mouse coordinates must be positive numbers.')
    }

    const downFlag = isRight ? 0x0008 : 0x0002
    const upFlag = isRight ? 0x0010 : 0x0004
    const ps = [
        '$signature = \'[DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y); [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);\'',
        '$mouse = Add-Type -MemberDefinition $signature -Name AkashsuuMouse -Namespace Win32 -PassThru',
        `[void]$mouse::SetCursorPos(${safeX}, ${safeY})`,
        'Start-Sleep -Milliseconds 80',
        `for ($i = 0; $i -lt ${safeClicks}; $i++) { $mouse::mouse_event(${downFlag}, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 50; $mouse::mouse_event(${upFlag}, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 90 }`
    ].join('; ')

    await runPowerShell(ps, 10000)
}

const FONT_3X5 = {
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    ',': ['000', '000', '000', '010', '100'],
    ' ': ['000', '000', '000', '000', '000']
}

const blendPixel = (png, x, y, color, alpha = 1) => {
    if (x < 0 || y < 0 || x >= png.width || y >= png.height) return
    const idx = (png.width * y + x) << 2
    png.data[idx] = Math.round((color[0] * alpha) + (png.data[idx] * (1 - alpha)))
    png.data[idx + 1] = Math.round((color[1] * alpha) + (png.data[idx + 1] * (1 - alpha)))
    png.data[idx + 2] = Math.round((color[2] * alpha) + (png.data[idx + 2] * (1 - alpha)))
    png.data[idx + 3] = 255
}

const drawText = (png, text, x, y, color = [255, 255, 255], scale = 2) => {
    let cursor = x
    for (const char of String(text)) {
        const glyph = FONT_3X5[char] || FONT_3X5[' ']
        for (let row = 0; row < glyph.length; row++) {
            for (let col = 0; col < glyph[row].length; col++) {
                if (glyph[row][col] !== '1') continue
                for (let sy = 0; sy < scale; sy++) {
                    for (let sx = 0; sx < scale; sx++) {
                        blendPixel(png, cursor + (col * scale) + sx, y + (row * scale) + sy, color, 0.95)
                    }
                }
            }
        }
        cursor += (4 * scale)
    }
}

const drawGridOverlay = (buffer) => {
    try {
        const png = PNG.sync.read(buffer)
        const major = 100
        const minor = 50
        const line = [255, 255, 255]
        const accent = [80, 180, 255]

        for (let x = 0; x < png.width; x += minor) {
            const isMajor = x % major === 0
            for (let y = 0; y < png.height; y++) {
                blendPixel(png, x, y, isMajor ? accent : line, isMajor ? 0.45 : 0.18)
            }
            if (isMajor) drawText(png, String(x), Math.min(x + 4, png.width - 34), 8, accent, 2)
        }

        for (let y = 0; y < png.height; y += minor) {
            const isMajor = y % major === 0
            for (let x = 0; x < png.width; x++) {
                blendPixel(png, x, y, isMajor ? accent : line, isMajor ? 0.45 : 0.18)
            }
            if (isMajor) drawText(png, String(y), 8, Math.min(y + 4, png.height - 14), accent, 2)
        }

        drawText(png, '0,0', 8, 8, [255, 255, 255], 2)
        return PNG.sync.write(png)
    } catch {
        return buffer
    }
}

const typeIntoFocusedWindow = async (text, pressEnter = false) => {
    const value = cleanText(text).slice(0, 1000)
    if (!value) throw new Error('No text was provided to type.')
    if (isDangerous(value)) throw new Error('Blocked unsafe text.')

    const ps = [
        `$oldClipboard = Get-Clipboard -Raw -ErrorAction SilentlyContinue`,
        `Set-Clipboard -Value '${psEscape(value)}'`,
        '$wshell = New-Object -ComObject WScript.Shell',
        'Start-Sleep -Milliseconds 250',
        "$wshell.SendKeys('^v')",
        pressEnter ? "Start-Sleep -Milliseconds 150; $wshell.SendKeys('{ENTER}')" : '',
        'Start-Sleep -Milliseconds 150',
        'if ($null -ne $oldClipboard) { Set-Clipboard -Value $oldClipboard }'
    ].filter(Boolean).join('; ')

    await runPowerShell(ps, 10000)
}

const clickFirstBrowserLink = async (browser = 'chrome') => {
    const label = browserLabel(browser)
    const processName = browser === 'msedge' ? 'msedge' : 'chrome'
    const titleHint = browser === 'msedge' ? 'Microsoft Edge' : 'Google Chrome'
    const ps = [
        '$wshell = New-Object -ComObject WScript.Shell',
        `$activated = $wshell.AppActivate('${psEscape(titleHint)}')`,
        `if (-not $activated) { $activated = $wshell.AppActivate('${psEscape(processName)}') }`,
        `if (-not $activated) { throw '${psEscape(label)} is not open or could not be focused.' }`,
        'Start-Sleep -Milliseconds 700',
        "$wshell.SendKeys('{ESC}')",
        'Start-Sleep -Milliseconds 150',
        'for ($i = 0; $i -lt 7; $i++) { $wshell.SendKeys("{TAB}"); Start-Sleep -Milliseconds 90 }',
        "$wshell.SendKeys('{ENTER}')"
    ].join('; ')

    await runPowerShell(ps, 12000)
}

const takeScreenshot = async () => {
    try {
        const screenshot = require('screenshot-desktop')
        const buffer = await screenshot({ format: 'png' })
        const image = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
        if (!image.length) throw new Error('Screenshot file was empty')
        const gridded = drawGridOverlay(image)

        return {
            buffer: gridded,
            cleanup: () => Promise.resolve()
        }
    } catch (err) {
        if (err?.code === 'MODULE_NOT_FOUND' || /Cannot find module 'screenshot-desktop'/.test(String(err?.message))) {
            throw new Error('Screenshot helper is missing. Run npm install on the bot folder, then restart the bot.')
        }

        // Fallback for older installs. Some antivirus tools block this path, so the
        // normal path above avoids PowerShell entirely.
        const fallback = await takeScreenshotWithPowerShell()
        return fallback
    }
}

const takeScreenshotWithPowerShell = async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'akashsuu-pc-'))
    const file = path.join(dir, 'screenshot.png')
    const ps = [
        'Add-Type -AssemblyName System.Windows.Forms',
        'Add-Type -AssemblyName System.Drawing',
        '$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen',
        '$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height',
        '$graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
        '$graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size)',
        '$maxWidth = 1280',
        'if ($bitmap.Width -gt $maxWidth) {',
        '  $ratio = $maxWidth / $bitmap.Width',
        '  $newHeight = [int]($bitmap.Height * $ratio)',
        '  $scaled = New-Object System.Drawing.Bitmap $maxWidth, $newHeight',
        '  $scaledGraphics = [System.Drawing.Graphics]::FromImage($scaled)',
        '  $scaledGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
        '  $scaledGraphics.DrawImage($bitmap, 0, 0, $maxWidth, $newHeight)',
        `  $scaled.Save('${psEscape(file)}', [System.Drawing.Imaging.ImageFormat]::Png)`,
        '  $scaledGraphics.Dispose()',
        '  $scaled.Dispose()',
        '} else {',
        `  $bitmap.Save('${psEscape(file)}', [System.Drawing.Imaging.ImageFormat]::Png)`,
        '}',
        '$graphics.Dispose()',
        '$bitmap.Dispose()'
    ].join('; ')

    await runPowerShell(ps, 20000)
    const buffer = await fs.readFile(file)
    if (!buffer.length) throw new Error('Screenshot file was empty')

    return {
        file,
        buffer: drawGridOverlay(buffer),
        cleanup: () => fs.rm(dir, { recursive: true, force: true }).catch(() => null)
    }
}

const normalizeUrl = (value) => {
    const raw = cleanText(value)
    if (!raw) return null
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const parsed = new URL(withProtocol)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    return parsed.href
}

const parseJson = (value) => {
    const text = String(value || '').trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null

    try {
        return JSON.parse(match[0])
    } catch {
        return null
    }
}

const normalizeToolName = (value) => {
    const name = cleanText(value).toLowerCase().replace(/[\s-]+/g, '_')
    if (name === 'search_google') return 'search_web'
    if (name === 'click_first_result') return 'click_first_link'
    if (name === 'keyboard_press') return 'press_key'
    if (name === 'click_mouse') return 'mouse_click'
    if (name === 'quit_app' || name === 'exit_app') return 'close_app'
    return name
}

const getToolPayload = (data) => {
    if (!data || typeof data !== 'object') return null

    if (data.function?.name) {
        let args = data.function.arguments || {}
        if (typeof args === 'string') {
            try {
                args = JSON.parse(args)
            } catch {
                args = {}
            }
        }

        return {
            name: data.function.name,
            arguments: args,
            description: data.description
        }
    }

    return data
}

const normalizeIntent = (intent, preferredBrowser = 'chrome') => {
    return sanitizeAiIntent(intent, preferredBrowser)
}

const sanitizeAiIntent = (data, preferredBrowser = 'chrome') => {
    const toolPayload = getToolPayload(data)
    if (!toolPayload || typeof toolPayload !== 'object') return null

    const args = toolPayload.arguments && typeof toolPayload.arguments === 'object'
        ? toolPayload.arguments
        : toolPayload
    const action = normalizeToolName(toolPayload.name || toolPayload.tool || toolPayload.action)
    const browser = inferBrowser(args.browser || args.app || toolPayload.description || args.description, preferredBrowser)
    const description = cleanText(toolPayload.description || args.description)

    if (action === 'screenshot') {
        return {
            action: 'screenshot',
            description: description || 'Captured your screen.'
        }
    }

    if (action === 'refresh_desktop') {
        return {
            action: 'refreshDesktop',
            description: description || 'Refreshed the Windows desktop.'
        }
    }

    if (action === 'click_first_link') {
        return {
            action: 'clickFirstLink',
            browser,
            description: description || `Clicked the first link in ${browserLabel(browser)}.`
        }
    }

    if (action === 'type_text') {
        const text = cleanText(args.text)
        if (!text || isDangerous(text)) return null
        const pressEnter = args.press_enter === true || args.pressEnter === true
        return {
            action: 'typeText',
            text: text.slice(0, 1000),
            pressEnter,
            description: description || `${pressEnter ? 'Typed and sent' : 'Typed'} text into the focused window.`
        }
    }

    if (action === 'press_key') {
        const key = cleanText(args.key)
        const times = Math.min(Math.max(Number.parseInt(args.times, 10) || 1, 1), 20)
        if (!KEY_MAP[key.toLowerCase()]) return null
        return {
            action: 'pressKey',
            key,
            times,
            description: description || `Pressed ${key}${times > 1 ? ` ${times} times` : ''}.`
        }
    }

    if (action === 'mouse_click') {
        const x = Number(args.x)
        const y = Number(args.y)
        const clicks = Math.min(Math.max(Number.parseInt(args.clicks, 10) || 1, 1), 3)
        const button = cleanText(args.button || 'left').toLowerCase() === 'right' ? 'right' : 'left'
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null
        return {
            action: 'mouseClick',
            x,
            y,
            button,
            clicks,
            description: description || `Clicked ${button} mouse at ${Math.round(x)}, ${Math.round(y)}.`
        }
    }

    if (action === 'search_web') {
        const query = cleanText(args.query)
        if (!query || isDangerous(query)) return null
        const openFirst = args.open_first_result === true || args.openFirstResult === true
        if (openFirst) {
            return {
                action: 'plan',
                steps: [
                    {
                        action: 'openUrl',
                        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                        browser,
                        query,
                        isSearch: true,
                        description: `Opened ${browserLabel(browser)} and searched Google for "${query}".`
                    },
                    {
                        action: 'clickFirstLink',
                        browser,
                        description: `Clicked the first link in ${browserLabel(browser)}.`
                    }
                ],
                description: description || `Opened the first Google result for "${query}" in ${browserLabel(browser)}.`
            }
        }
        return {
            action: 'openUrl',
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
            browser,
            query,
            isSearch: true,
            description: description || `Opened ${browserLabel(browser)} and searched Google for "${query}".`
        }
    }

    if (action === 'open_url') {
        const url = normalizeUrl(args.url)
        if (!url || isDangerous(url)) return null
        return {
            action: 'openUrl',
            url,
            browser,
            description: description || `Opened ${url}.`
        }
    }

    if (action === 'open_app') {
        const appName = cleanText(args.app).toLowerCase()
        const app = APP_ALIASES[appName]
        if (!app) return null
        return {
            action: 'openApp',
            app,
            description: description || `Opened ${appName}.`
        }
    }

    if (action === 'close_app') {
        const appName = cleanText(args.app).toLowerCase()
        const app = APP_ALIASES[appName]
        if (!app) return null
        return {
            action: 'closeApp',
            app,
            description: description || `Closed ${appName}.`
        }
    }

    return null
}

const sanitizeAiPlan = (data, request = '') => {
    const preferredBrowser = inferBrowser(request)
    const rawActions = Array.isArray(data?.actions)
        ? data.actions
        : Array.isArray(data?.tool_calls)
            ? data.tool_calls
            : Array.isArray(data?.tools)
                ? data.tools
        : Array.isArray(data)
            ? data
            : data ? [data] : []

    const steps = rawActions
        .map((intent) => normalizeIntent(intent, preferredBrowser))
        .filter(Boolean)
        .slice(0, 5)

    const compactSteps = compactBrowserSteps(steps)

    if (!compactSteps.length) return null

    return {
        action: 'plan',
        steps: compactSteps,
        description: compactSteps.map((step, index) => `${index + 1}. ${step.description}`).join('\n')
    }
}

const compactBrowserSteps = (steps) => {
    const hasBrowserUrl = steps.some((step) => step.action === 'openUrl' && ['chrome', 'msedge'].includes(step.browser))
    if (!hasBrowserUrl) return steps

    return steps.filter((step) => {
        if (step.action !== 'openApp') return true
        if (!['chrome', 'msedge'].includes(step.app)) return true
        return false
    })
}

const parseIntentWithAi = async (client, request) => {
    const apiKey = process.env.GROQ_API_KEY || client.config.GROQ_API_KEY
    if (!apiKey) return null

    const toolList = MCP_TOOL_DEFINITIONS
        .map((tool) => `${tool.name}: ${tool.description} args=${JSON.stringify(tool.arguments)}`)
        .join('\n')
    const response = await axios.post(
        GROQ_CHAT_URL,
        {
            model: process.env.GROQ_MODEL || client.config.GROQ_MODEL || DEFAULT_GROQ_MODEL,
            temperature: 0,
            max_tokens: 180,
            messages: [
                {
                    role: 'system',
                    content: [
                        'You are an MCP-style safe PC tool router for a Discord bot.',
                        'Choose only from the provided tools and return tool calls, never prose.',
                        'For multiple requests, return {"tool_calls":[{"name":"tool_name","arguments":{}}]} in order.',
                        'Available tools:',
                        toolList,
                        'Never output shell, powershell, cmd code, file deletion, install, uninstall, shutdown, restart, secrets, tokens, passwords, or destructive actions.',
                        'If unsafe or unclear, return {"action":"ask","question":"short question"}.',
                        'If the user asks to search and click the first result, use search_web with open_first_result true instead of opening the browser separately. Do not use Google btnI or redirect URLs.',
                        'If the user asks to type, write, paste, or send a message in the active app, use type_text. Set press_enter true only when they clearly ask to send or press enter.',
                        'If the user gives screen coordinates, use mouse_click. If they asks to press a key, use press_key.',
                        'Return JSON only. No markdown.',
                        'Examples:',
                        '{"tool_calls":[{"name":"search_web","arguments":{"query":"spotify","browser":"msedge","open_first_result":false}}]}',
                        '{"tool_calls":[{"name":"search_web","arguments":{"query":"github","browser":"chrome","open_first_result":true}}]}'
                    ].join(' ')
                },
                {
                    role: 'user',
                    content: request
                }
            ]
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 12000
        }
    )

    const content = response.data?.choices?.[0]?.message?.content
    const data = parseJson(content)
    if (String(data?.action || '').toLowerCase() === 'ask') {
        return {
            action: 'ask',
            question: cleanText(data.question) || 'What should I open or search?'
        }
    }

    return sanitizeAiPlan(data, request)
}

const parseIntentPlan = (input) => {
    const text = cleanText(input)
    const lower = text.toLowerCase()
    const preferredBrowser = inferBrowser(text)
    const steps = []

    if (!text) return null

    if (/\b(update|pull)\b.*\b(bot|files|code|repo)\b|\bgit\s+pull\b/i.test(lower)) {
        return {
            action: 'botUpdate',
            description: 'Updated bot files with git pull, installed packages, then restarted the bot.'
        }
    }

    if (/\b(restart|reboot)\b.*\b(bot|client)\b/i.test(lower)) {
        return {
            action: 'botRestart',
            description: 'Restarted the bot process.'
        }
    }

    if (/\bnpm\s+install\b/i.test(lower)) {
        return {
            action: 'botInstall',
            description: 'Installed bot packages with npm install.'
        }
    }

    if (/\b(screen\s*shot|screenshot|capture\s+screen)\b/i.test(lower)) {
        steps.push({
            action: 'screenshot',
            description: 'Captured your screen.'
        })
    }

    if (/\brefresh\b.*\b(desktop|desk|screen)\b|\bdesktop\b.*\brefresh\b/i.test(lower)) {
        steps.push({
            action: 'refreshDesktop',
            description: 'Refreshed the Windows desktop.'
        })
    }

    const shouldClickFirstLink = /\b(click|open|select|press)\b.*\b(first|top|1st)\b.*\b(link|result)\b/i.test(lower)
    const hasSearchOrUrl = /\b(search|google)\b/i.test(lower) || /https?:\/\/\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i.test(text)
    const typeMatch = text.match(/\b(?:type|write|paste)\s+(.+)$/i)
        || text.match(/\b(?:send|send\s+message|message)\s+(.+)$/i)
    const typedText = typeMatch ? cleanText(typeMatch[1]).replace(/\s+(?:and\s+)?(?:press\s+)?enter$/i, '') : ''
    const shouldPressEnter = !!typeMatch && /\b(send|send\s+message|press\s+enter|hit\s+enter)\b/i.test(lower)

    for (const [alias, app] of Object.entries(APP_ALIASES)) {
        const closePattern = new RegExp(`\\b(close|quit|exit)\\s+${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        if (closePattern.test(lower)) {
            steps.push({
                action: 'closeApp',
                app,
                description: `Closed ${alias}.`
            })
            continue
        }

        const pattern = new RegExp(`\\b(open|start|launch)\\s+${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        if (pattern.test(lower)) {
            if (['chrome', 'msedge'].includes(app) && hasSearchOrUrl) continue
            steps.push({
                action: 'openApp',
                app,
                description: `Opened ${alias}.`
            })
        }
    }

    const urlMatch = text.match(/https?:\/\/\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i)
    if (urlMatch) {
        const url = normalizeUrl(urlMatch[0])
        if (url) {
            steps.push({
                action: 'openUrl',
                url,
                browser: preferredBrowser,
                description: `Opened ${url}.`
            })
        }
    }

    const searchMatches = [
        ...text.matchAll(/\bsearch(?:\s+google)?\s+(.+?)(?:\s+in\s+(?:chrome|google\s+chrome|microsoft\s+edge|ms\s+edge|edge|browser)|$|,| and )/gi),
        ...text.matchAll(/\bgoogle\s+(.+?)(?:$|,| and )/gi)
    ]

    for (const match of searchMatches) {
        const query = cleanText(match[1]).replace(/^(and\s+)?open\s+/i, '')
        if (query && !isDangerous(query)) {
            steps.push({
                action: 'openUrl',
                url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                browser: preferredBrowser,
                query,
                isSearch: true,
                description: `Opened ${browserLabel(preferredBrowser)} and searched Google for "${query}".`
            })
        }
    }

    if (shouldClickFirstLink) {
        steps.push({
            action: 'clickFirstLink',
            browser: preferredBrowser,
            description: `Clicked the first link in ${browserLabel(preferredBrowser)}.`
        })
    }

    if (typedText && !isDangerous(typedText)) {
        steps.push({
            action: 'typeText',
            text: typedText.slice(0, 1000),
            pressEnter: shouldPressEnter,
            description: `${shouldPressEnter ? 'Typed and sent' : 'Typed'} text into the focused window.`
        })
    }

    const keyMatch = text.match(/\b(?:press|hit)\s+(ctrl\+[a-z]|enter|tab|escape|esc|backspace|space|up|down|left|right|home|end)(?:\s+(\d+)\s+times?)?/i)
    if (keyMatch) {
        steps.push({
            action: 'pressKey',
            key: keyMatch[1],
            times: Number.parseInt(keyMatch[2], 10) || 1,
            description: `Pressed ${keyMatch[1]}.`
        })
    }

    const mouseMatch = text.match(/\b(?:mouse\s+)?(?:click|left\s+click|right\s+click)\s+(?:at\s+)?(\d{1,5})\s*[,x ]\s*(\d{1,5})/i)
    if (mouseMatch) {
        const isRight = /\bright\s+click\b/i.test(lower)
        steps.push({
            action: 'mouseClick',
            x: Number(mouseMatch[1]),
            y: Number(mouseMatch[2]),
            button: isRight ? 'right' : 'left',
            clicks: 1,
            description: `Clicked ${isRight ? 'right' : 'left'} mouse at ${mouseMatch[1]}, ${mouseMatch[2]}.`
        })
    }

    const unique = []
    const seen = new Set()
    for (const step of steps) {
        const key = `${step.action}:${step.app || step.url || step.description}`
        if (seen.has(key)) continue
        seen.add(key)
        unique.push(step)
    }

    const compactUnique = compactBrowserSteps(unique)

    if (!compactUnique.length) return null
    if (compactUnique.length === 1) return compactUnique[0]

    return {
        action: 'plan',
        steps: compactUnique.slice(0, 5),
        description: compactUnique.slice(0, 5).map((step, index) => `${index + 1}. ${step.description}`).join('\n')
    }
}

const parseIntent = (input) => {
    const text = cleanText(input)
    const lower = text.toLowerCase()
    const preferredBrowser = inferBrowser(text)

    if (!text) return null
    if (/\b(screen\s*shot|screenshot|capture\s+screen)\b/i.test(lower)) {
        return {
            action: 'screenshot',
            description: 'Captured your screen.'
        }
    }

    if (/\b(update|pull)\b.*\b(bot|files|code|repo)\b|\bgit\s+pull\b/i.test(lower)) {
        return {
            action: 'botUpdate',
            description: 'Updated bot files with git pull, installed packages, then restarted the bot.'
        }
    }

    if (/\b(restart|reboot)\b.*\b(bot|client)\b/i.test(lower)) {
        return {
            action: 'botRestart',
            description: 'Restarted the bot process.'
        }
    }

    if (/\bnpm\s+install\b/i.test(lower)) {
        return {
            action: 'botInstall',
            description: 'Installed bot packages with npm install.'
        }
    }

    const typeMatch = text.match(/\b(?:type|write|paste)\s+(.+)$/i)
        || text.match(/\b(?:send|send\s+message|message)\s+(.+)$/i)
    if (typeMatch?.[1]) {
        const typedText = cleanText(typeMatch[1]).replace(/\s+(?:and\s+)?(?:press\s+)?enter$/i, '')
        const pressEnter = /\b(send|send\s+message|press\s+enter|hit\s+enter)\b/i.test(lower)
        if (typedText && !isDangerous(typedText)) {
            return {
                action: 'typeText',
                text: typedText.slice(0, 1000),
                pressEnter,
                description: `${pressEnter ? 'Typed and sent' : 'Typed'} text into the focused window.`
            }
        }
    }

    const keyMatch = text.match(/\b(?:press|hit)\s+(ctrl\+[a-z]|enter|tab|escape|esc|backspace|space|up|down|left|right|home|end)(?:\s+(\d+)\s+times?)?/i)
    if (keyMatch) {
        return {
            action: 'pressKey',
            key: keyMatch[1],
            times: Number.parseInt(keyMatch[2], 10) || 1,
            description: `Pressed ${keyMatch[1]}.`
        }
    }

    const mouseMatch = text.match(/\b(?:mouse\s+)?(?:click|left\s+click|right\s+click)\s+(?:at\s+)?(\d{1,5})\s*[,x ]\s*(\d{1,5})/i)
    if (mouseMatch) {
        const isRight = /\bright\s+click\b/i.test(lower)
        return {
            action: 'mouseClick',
            x: Number(mouseMatch[1]),
            y: Number(mouseMatch[2]),
            button: isRight ? 'right' : 'left',
            clicks: 1,
            description: `Clicked ${isRight ? 'right' : 'left'} mouse at ${mouseMatch[1]}, ${mouseMatch[2]}.`
        }
    }

    const shouldClickFirstLink = /\b(click|open|select|press)\b.*\b(first|top|1st)\b.*\b(link|result)\b/i.test(lower)
    if (shouldClickFirstLink) {
        return {
            action: 'clickFirstLink',
            browser: preferredBrowser,
            description: `Clicked the first link in ${browserLabel(preferredBrowser)}.`
        }
    }

    const searchMatch = lower.match(/\bsearch(?:\s+google)?\s+(.+)$/i)
        || lower.match(/\bopen\s+chrome\s+and\s+search\s+(.+)$/i)
        || lower.match(/\bopen\s+(?:microsoft\s+edge|ms\s+edge|edge)\s+and\s+search\s+(.+)$/i)
        || lower.match(/\bgoogle\s+(.+)$/i)
    if (searchMatch?.[1]) {
        const query = cleanText(searchMatch[1])
        return {
            action: 'openUrl',
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
            browser: preferredBrowser,
            query,
            isSearch: true,
            description: `Opened ${browserLabel(preferredBrowser)} and searched Google for "${query}".`
        }
    }

    const urlMatch = text.match(/https?:\/\/\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i)
    if (urlMatch) {
        const url = normalizeUrl(urlMatch[0])
        return {
            action: 'openUrl',
            url,
            browser: preferredBrowser,
            description: `Opened ${url}.`
        }
    }

    for (const [alias, app] of Object.entries(APP_ALIASES)) {
        const closePattern = new RegExp(`\\b(close|quit|exit)\\s+${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        if (closePattern.test(lower)) {
            return {
                action: 'closeApp',
                app,
                description: `Closed ${alias}.`
            }
        }

        const pattern = new RegExp(`\\b(open|start|launch)\\s+${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        if (pattern.test(lower)) {
            return {
                action: 'openApp',
                app,
                description: `Opened ${alias}.`
            }
        }
    }

    return null
}

const executeIntent = async (intent) => {
    if (intent.action === 'plan') {
        for (const step of intent.steps) {
            await executeIntent(step)
            await new Promise((resolve) => setTimeout(resolve, 700))
        }
        return
    }

    if (intent.action === 'screenshot') return

    if (intent.action === 'refreshDesktop') {
        await runPowerShell([
            '$shell = New-Object -ComObject Shell.Application',
            '$shell.ToggleDesktop()',
            'Start-Sleep -Milliseconds 250',
            '$wshell = New-Object -ComObject WScript.Shell',
            "$wshell.SendKeys('{F5}')"
        ].join('; '), 10000)
        return
    }

    if (intent.action === 'botUpdate') {
        await execFileAsync('git', ['pull'], {
            cwd: process.cwd(),
            windowsHide: true,
            timeout: 120000,
            maxBuffer: 1024 * 1024
        })
        await execFileAsync('npm', ['install'], {
            cwd: process.cwd(),
            windowsHide: true,
            timeout: 120000,
            maxBuffer: 1024 * 1024
        })
        setTimeout(() => process.exit(0), 2000)
        return
    }

    if (intent.action === 'botInstall') {
        await execFileAsync('npm', ['install'], {
            cwd: process.cwd(),
            windowsHide: true,
            timeout: 120000,
            maxBuffer: 1024 * 1024
        })
        return
    }

    if (intent.action === 'botRestart') {
        setTimeout(() => process.exit(0), 2000)
        return
    }

    if (intent.action === 'openUrl') {
        const browser = intent.browser === 'msedge' ? 'msedge' : 'chrome'
        if (intent.isSearch && intent.query) {
            lastBrowserSearch = {
                browser,
                query: intent.query,
                at: Date.now()
            }
        } else {
            try {
                const parsed = new URL(intent.url)
                const query = parsed.hostname.includes('google.')
                    ? parsed.searchParams.get('q')
                    : null
                if (query) {
                    lastBrowserSearch = { browser, query, at: Date.now() }
                }
            } catch {
                // Ignore non-URL values; normalizeUrl already validated normal URL actions.
            }
        }
        await runCmdStart(browser, [intent.url], 10000)
        return
    }

    if (intent.action === 'clickFirstLink') {
        const browser = intent.browser === 'msedge' ? 'msedge' : 'chrome'
        const savedSearch = lastBrowserSearch && (!intent.browser || lastBrowserSearch.browser === browser)
            ? lastBrowserSearch
            : lastBrowserSearch

        if (savedSearch?.query) {
            const targetBrowser = savedSearch.browser || browser
            await runCmdStart(targetBrowser, [`https://www.google.com/search?q=${encodeURIComponent(savedSearch.query)}`], 10000)
            await new Promise((resolve) => setTimeout(resolve, 1600))
            await clickFirstBrowserLink(targetBrowser)
            return
        }

        await clickFirstBrowserLink(browser)
        return
    }

    if (intent.action === 'typeText') {
        await typeIntoFocusedWindow(intent.text, intent.pressEnter)
        return
    }

    if (intent.action === 'pressKey') {
        await pressKeyboardKey(intent.key, intent.times)
        return
    }

    if (intent.action === 'mouseClick') {
        await clickMouse(intent.x, intent.y, intent.button, intent.clicks)
        return
    }

    if (intent.action === 'openApp') {
        await openWhitelistedApp(intent.app)
        return
    }

    if (intent.action === 'closeApp') {
        await closeWhitelistedApp(intent.app)
    }
}

module.exports = {
    name: 'pc',
    aliases: ['computer', 'win'],
    category: 'owner',
    cooldown: 5,
    run: async (client, message, args) => {
        if (!isAuthorized(client, message.author.id)) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | You are not authorized to use PC control.`)
                ]
            })
        }

        const request = cleanText(args.join(' '))
        if (!request) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${message.guild.prefix}pc open chrome and search github\``)
                ]
            })
        }

        const allowBotRestart = /\b(restart|reboot)\b.*\b(bot|client)\b/i.test(request)
        if (isDangerous(request) && !allowBotRestart) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Blocked. I only run safe PC actions like opening apps, searching websites, and screenshots.`)
                ]
            })
        }

        let intent = parseIntentPlan(request) || parseIntent(request)
        if (!intent) {
            try {
                intent = await parseIntentWithAi(client, request)
            } catch (err) {
                client.logger?.log?.(`pc ai parser failed: ${err.message}`, 'warn')
            }
        }

        if (intent?.action === 'ask') {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | ${intent.question}`)
                ]
            })
        }

        if (!intent) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | I am not sure what to do. Try: \`${message.guild.prefix}pc open chrome\`, \`${message.guild.prefix}pc search github\`, \`${message.guild.prefix}pc update bot\`, or \`${message.guild.prefix}pc screenshot\`.`)
                ]
            })
        }

        try {
            await executeIntent(intent)
            await new Promise((resolve) => setTimeout(resolve, SCREENSHOT_DELAY_MS))

            let shot = null
            let screenshotError = null
            try {
                shot = await takeScreenshot()
            } catch (err) {
                screenshotError = err
                client.logger?.log?.(`pc screenshot failed: ${err.stack || err.message}`, 'error')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('PC Action Complete')
                .setDescription(screenshotError
                    ? `${intent.description}\n\n${client.emoji.cross} | Screenshot failed: \`${String(screenshotError.message || screenshotError).slice(0, 180)}\``
                    : intent.description)
                .setFooter({
                    text: 'akashsuu pc control',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            const payload = { embeds: [embed] }

            if (shot?.buffer?.length) {
                const attachment = new AttachmentBuilder(shot.buffer, {
                    name: 'pc-screenshot.png'
                })
                embed.setImage('attachment://pc-screenshot.png')
                payload.files = [attachment]
            }

            const sent = await message.channel.send(payload)
            if (shot) await shot.cleanup()
            return sent
        } catch (err) {
            client.logger?.log?.(`pc command error: ${err.stack || err.message}`, 'error')
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | PC action failed: \`${String(err.message || err).slice(0, 220)}\``)
                ]
            })
        }
    }
}

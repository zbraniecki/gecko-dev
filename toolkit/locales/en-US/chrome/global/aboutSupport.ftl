brandShortName = Firefox

aboutSupport-pageTitle = Troubleshooting Information

aboutSupport-pageSubtitle =
  | This page contains technical information that might be useful when you’re
  | trying to solve a problem. If you are looking for answers to common questions
  | about { brandShortName } check out our <a id="supportLink">support website</a>.

refreshProfile-dialog-title = Give { brandShortName } a tune up
refreshProfile-button = Refresh { brandShortName}...

aboutSupport-safeModeTitle = Try Safe Mode
aboutSupport-restartInSafeMode = Restart with Add-ons Disabled...

aboutSupport-copyRawDataToClipboard = Copy raw data to clipboard
aboutSupport-copyTextToClipboard = Copy text to clipboard
aboutSupport-rawDatCopied = Raw data copied to clipboard
aboutSupport-textCopied = Text copied to clipboard

aboutSupport-appBasicsTitle = Application Basics
aboutSupport-appBasicsName = Name
aboutSupport-appBasicsVersion = Version
aboutSupport-appBasicsBuildID = Build ID
aboutSupport-appBasicsUpdateChannel = Update Channel
aboutSupport-appBasicsUpdateHistory = Update History
aboutSupport-appBasicsShowUpdateHistory = Show Update History
aboutSupport-appBasicsUserAgent = User Agent
aboutSupport-appBasicsOS = OS
aboutSupport-appBasicsProfileDir = { OS() ->
  [win] Profile Folder
  [mac] Profile Folder
 *[other] Profile Directory
}
aboutSupport-showDir = { OS() ->
  [win] Show Folder
  [mac] Show in Finder
 *[other] Open Directory
}
aboutSupport-appBasicsEnabledPlugins = Enabled Plugins
aboutSupport-appBasicsBuildConfig = Build Configuration
aboutSupport-appBasicsMemoryUse = Memory Use
aboutSupport-appBasicsServiceWorkers = Registered Service Workers
aboutSupport-appBasicsMultiProcessSupport = Multiprocess Windows
aboutSupport-appBasicsSafeMode = Safe Mode
aboutSupport-appBasicsProfiles = Profiles

aboutSupport-multiProcessWindows = { $remote }/{ $total } ({ $status ->
  [0] Enabled by user
  [1] Enabled by default
  [2] Disabled
  [4] Disabled by accessibility tools
  [5] Disabled by lack of graphics hardware acceleration on Mac OS X
  [6] Disabled by unsupported text input
  [7] Disabled by add-ons
  [8] Disabled forcibly
  [9] Disabled by graphics hardware acceleration on Windows
 *[other] Unknown status
})

aboutSupport-crashes-title = { PLURAL($days) ->
  [one] Crash Reports for the Last { $days } day
 *[other] Crash Reports for the Last { $days } days
}
aboutSupport-crashes-id = Report ID
aboutSupport-crashes-sendDate = Submitted
aboutSupport-crashes-allReports = All Crash Reports
aboutSupport-crashes-noConfig =
  | This application has not been configured to display crash reports.
aboutSupport-crashes-pendingReports = { PLURAL($num) ->
  [one]
   | All Crash Reports (including { $num } pending crash in the given time range)
 *[other]
   | All Crash Reports (including { $num } pending crashes in the given time range)
}

aboutSupport-extensionsTitle = Extensions
aboutSupport-extensionName = Name
aboutSupport-extensionEnabled = Enabled
aboutSupport-extensionVersion = Version
aboutSupport-extensionId = ID

aboutSupport-graphicsTitle = Graphics
aboutSupport-graphicsFeaturesTitle = Features
aboutSupport-graphicsDiagnosticsTitle = Diagnostics
aboutSupport-graphicsFailureLogTitle = Failure Log
aboutSupport-graphicsGPU1Title = GPU #1
aboutSupport-graphicsGPU2Title = GPU #2
aboutSupport-graphicsDecisionLogTitle = Decision Log
aboutSupport-graphicsWorkaroundsTitle = Workarounds
aboutSupport-graphics-apzNone = none
aboutSupport-graphics-wheelEnabled = wheel input enabled
aboutSupport-graphics-touchEnabled = touch input enabled
aboutSupport-graphics-dragEnabled = scrollbar drag enabled
aboutSupport-graphics-yes = Yes
aboutSupport-graphics-no = No
aboutSupport-graphics-mainThreadNoOMTC = main thread, no OMTC
aboutSupport-graphics-clearTypeParameters = ClearType Parameters
aboutSupport-graphics-compositing = Compositing
aboutSupport-graphics-asyncPanZoom = Asynchronous Pan/Zoom
aboutSupport-graphics-gpuActive = Active
aboutSupport-graphics-webglRenderer = WebGL Renderer
aboutSupport-graphics-hardwareH264 = Hardware H264 Decoding
aboutSupport-graphics-gpuDescription = Description
aboutSupport-graphics-gpuVendorID = Vendor ID
aboutSupport-graphics-gpuDeviceID = Device ID
aboutSupport-graphics-gpuDriverVersion = Driver Version
aboutSupport-graphics-gpuDriverDate = Driver Date
aboutSupport-graphics-gpuDrivers = Drivers
aboutSupport-graphics-gpuSubsysID = Subsys ID
aboutSupport-graphics-gpuRAM = RAM
aboutSupport-graphics-webglRenderer = WebGL Renderer



aboutSupport-modifiedKeyPrefsTitle = Important Modified Preferences
aboutSupport-modifiedPrefsName = Name
aboutSupport-modifiedPrefsValue = Value

aboutSupport-userJSTitle = user.js Preferences
aboutSupport-userJSDescription =
  | Your profile folder contains a <a id='prefs-user-js-link'>user.js file</a>,
  | which includes preferences that were not created by { brandShortName }.


aboutSupport-lockedKeyPrefsTitle = Important Locked Preferences
aboutSupport-lockedPrefsName = Name
aboutSupport-lockedPrefsValue = Value


aboutSupport-jsTitle = JavaScript
aboutSupport-jsIncrementalGC = Incremental GC

aboutSupport-a11yTitle = Accessibility
aboutSupport-a11yActivated = Activated
aboutSupport-a11yForceDisabled = Prevent Accessibility


aboutSupport-libraryVersionsTitle = Library Versions
aboutSupport-minLibVersions = Expected minimum version
aboutSupport-loadedLibVersions = Version in use


aboutSupport-experimentsTitle = Experimental Features
aboutSupport-experimentName = Name
aboutSupport-experimentId = ID
aboutSupport-experimentDescription = Description
aboutSupport-experimentActive = Active
aboutSupport-experimentEndDate = End Date
aboutSupport-experimentHomepage = Homepage
aboutSupport-experimentBranch = Branch

aboutSupport-sandboxTitle = Sandbox
aboutSupport-hasSeccompBPF = Seccomp-BPF (System Call Filtering)
aboutSupport-hasSeccompTSync = Seccomp Thread Synchronization
aboutSupport-hasUserNamespaces = User Namespaces
aboutSupport-hasPrivilegedUserNamespaces = User Namespaces for privileged processes
aboutSupport-canSandboxContent = Content Process Sandboxing
aboutSupport-canSandboxMedia = Media Plugin Sandboxing


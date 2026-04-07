#define MyAppName "Agente de Monitoreo de Jornadas Remotas"
#define MyAppVersion "1.0"
#define MyAppPublisher "Tu Empresa"
#define MyAppExeName "index.js"

[Setup]
AppId={{12345678-1234-1234-1234-123456789ABC}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={pf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=.
OutputBaseFilename=AgenteMonitoreoSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "index.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "Config.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "Db.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "Identidad.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "Api.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "Polling.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "Monitor.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "Reporte.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "nssm.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion

[Run]
Filename: "{app}\nssm.exe"; Parameters: "install AgenteMonitoreo ""{pf}\nodejs\node.exe"" ""{app}\index.js"""; Flags: runhidden
Filename: "{app}\nssm.exe"; Parameters: "set AgenteMonitoreo AppDirectory ""{app}"""; Flags: runhidden
Filename: "{app}\nssm.exe"; Parameters: "set AgenteMonitoreo AppStdout ""{app}\logs.txt"""; Flags: runhidden
Filename: "{app}\nssm.exe"; Parameters: "set AgenteMonitoreo AppStderr ""{app}\errors.txt"""; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "start AgenteMonitoreo"; Flags: runhidden

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop AgenteMonitoreo"; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "delete AgenteMonitoreo"; Flags: runhidden

[Code]
function InitializeSetup(): Boolean;
begin
  // Verificar si Node.js está instalado
  if not RegKeyExists(HKEY_LOCAL_MACHINE, 'SOFTWARE\Node.js') then
  begin
    MsgBox('Node.js no está instalado. Por favor, instala Node.js primero.', mbError, MB_OK);
    Result := False;
  end
  else
    Result := True;
end;
Set objShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
objShell.CurrentDirectory = pasta

chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(chromePath) Then
  chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
End If

Sub AbrirPainel()
  If fso.FileExists(chromePath) Then
    objShell.Run """" & chromePath & """ --new-window http://localhost:3000", 1, False
  Else
    objShell.Run "http://localhost:3000", 1, False
  End If
End Sub

Sub GarantirAtalhoNaAreaDeTrabalho()
  atalhoPath = objShell.SpecialFolders("Desktop") & "\Atendente WhatsApp - Click Sim.lnk"
  iconPath = pasta & "\public\logo.ico"

  precisaCriar = True
  If fso.FileExists(atalhoPath) Then
    Set atalhoExistente = objShell.CreateShortcut(atalhoPath)
    If LCase(atalhoExistente.TargetPath) = LCase(WScript.ScriptFullName) Then
      precisaCriar = False
    End If
  End If

  If precisaCriar Then
    Set atalho = objShell.CreateShortcut(atalhoPath)
    atalho.TargetPath = WScript.ScriptFullName
    atalho.WorkingDirectory = pasta
    atalho.WindowStyle = 7
    atalho.Description = "Atendente WhatsApp - Click Sim Perfumaria"
    If fso.FileExists(iconPath) Then
      atalho.IconLocation = iconPath
    End If
    atalho.Save
  End If
End Sub

GarantirAtalhoNaAreaDeTrabalho()

' Verifica se o atendente ja esta rodando (evita abrir duas instancias
' ao mesmo tempo, o que corrompe a sessao do WhatsApp)
jaRodando = False
pidFile = pasta & "\pid.txt"

If fso.FileExists(pidFile) Then
  Set f = fso.OpenTextFile(pidFile, 1)
  pid = Trim(f.ReadLine())
  f.Close
  If pid <> "" Then
    Set colProcessos = GetObject("winmgmts:").ExecQuery( _
      "Select * from Win32_Process Where ProcessId = " & pid & " and Name = 'node.exe'")
    If colProcessos.Count > 0 Then
      jaRodando = True
    End If
  End If
End If

If jaRodando Then
  MsgBox "O atendente ja esta em execucao. Abrindo o painel...", 64, "Atendente WhatsApp"
  AbrirPainel()
Else
  ' Liga o atendente em segundo plano, sem mostrar janela preta
  objShell.Run "cmd /c npm start > logs.txt 2>&1", 0, False

  ' Espera o servidor subir e abre o painel no Chrome
  WScript.Sleep 3000
  AbrirPainel()
End If

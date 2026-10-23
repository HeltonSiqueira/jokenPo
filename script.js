let HandLandmarker, FilesetResolver, DrawingUtils;

const $ = (id) => document.getElementById(id);
const video = $("video"), canvas = $("overlay"), ctx = canvas.getContext("2d");
const choices = ["pedra", "papel", "tesoura"];
const symbols = {pedra:"✊", papel:"✋", tesoura:"✌️"};
const titles = {pedra:"Pedra", papel:"Papel", tesoura:"Tesoura"};
const HOLD_START = 3000, HOLD_READY = 2000, STABLE_CAPTURE = 650, CAPTURE_GRACE_MS = 1200, CAPTURE_WINDOW_MS = 5000, RESULT_DISPLAY_MS = 30000;
let landmarker, drawing, stream, state = "offline", stateSince = 0;
let candidate = "", candidateSince = 0, scoreHuman = 0, scoreCpu = 0, round = 1;
let cpuMove = null, lastVideoTime = -1, countdownStart = 0, captured = false;
let lastGesture = null, lastTick = 0;
// Tempo de abandono: conta apenas quando aguardamos o punho fechado.
// Presença de qualquer mão (mesmo com gesto não classificado) reinicia a espera.
const INACTIVITY_MS = 45000, INACTIVITY_WARNING_MS = 10000;
let lastHandSeenAt = 0, handPresent = false;
const defaultNotice = "Dica: posicione uma mão inteira dentro do enquadramento.";
function updateInactivity(now) {
  if(state!=="ready") return false;
  if(handPresent) lastHandSeenAt=now;
  const elapsed=now-lastHandSeenAt;
  if(elapsed>=INACTIVITY_MS) {
    $("notice").classList.remove("inactivityWarning");
    $("notice").textContent=defaultNotice;
    showAttract();
    return true;
  }
  const remaining=INACTIVITY_MS-elapsed;
  if(remaining<=INACTIVITY_WARNING_MS) {
    $("notice").classList.add("inactivityWarning");
    $("notice").textContent=`⏳ AGUARDANDO JOGADOR — Voltando à abertura em ${Math.ceil(remaining/1000)}s. ✋ Mostre sua mão para continuar!`;
  } else {
    $("notice").classList.remove("inactivityWarning");
    $("notice").textContent=defaultNotice;
  }
  return false;
}
let soundOn = true, audioCtx = null, lastCountdownNumber = null;
let requestedCameraId = null;
let startAfterCamera = false;

function tone(freq=440, duration=.12, type="sine", delay=0) {
  if (!soundOn || !audioCtx) return;
  try {
    const t=audioCtx.currentTime+delay, osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,t);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(.11,t+.018);
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain).connect(audioCtx.destination);osc.start(t);osc.stop(t+duration+.03);
  } catch(e) {console.warn("Som indisponível",e);}
}
function soundResult(result) {
  if(result>0) {tone(523,.16);tone(659,.16,"sine",.18);tone(784,.28,"sine",.36);}
  else if(result<0) {tone(392,.2,"triangle");tone(294,.28,"triangle",.22);}
  else {tone(440,.18);tone(440,.18,"sine",.24);}
}
function celebrate(title) {
  $("celebrationTitle").textContent=title;
  $("finalHumanScore").textContent=String(scoreHuman);
  $("finalJarvisScore").textContent=String(scoreCpu);
  $("celebration").dataset.winner=scoreHuman>scoreCpu?"student":scoreHuman<scoreCpu?"jarvis":"draw";
  $("celebrationIcon").textContent=scoreHuman>scoreCpu?"🏆":scoreHuman<scoreCpu?"🤖":"🤝";
  $("celebration").classList.add("visible");
  $("celebration").setAttribute("aria-hidden","false");
}
const openingMusic = $("openingMusic");
const gameMusic = $("gameMusic");
async function playGameMusic() {
  openingMusic.pause();
  gameMusic.currentTime=0;
  try {await gameMusic.play();}
  catch(err) {
    console.warn("A música da partida não pôde iniciar:",err);
    $("notice").textContent="Música da partida indisponível: confira back-in-black.mp3. O jogo continua normalmente.";
  }
}
function stopGameMusic() {
  gameMusic.pause();
  gameMusic.currentTime=0;
}

// Música da abertura habilitada por padrão. O usuário pode pausá-la manualmente.
// Alguns navegadores bloqueiam áudio automático até a primeira interação.
let musicEnabled = true;
function updateMusicButton(){
  $("musicButton").textContent=musicEnabled?"♫ PAUSAR MÚSICA":"♫ RETOMAR MÚSICA";
  $("musicButton").setAttribute("aria-pressed",String(musicEnabled));
}
async function playOpeningMusic(){
  if(!musicEnabled || !$("attractScreen").classList.contains("visible")) return;
  try {
    await openingMusic.play();
    $("musicStatus").textContent="";
  } catch(err) {
    console.info("Navegador aguardando interação para liberar o áudio:",err);
    $("musicStatus").textContent="Se a música não começar, clique uma vez na tela para liberar o áudio.";
  }
}
$("musicButton").addEventListener("click",async()=>{
  musicEnabled=!musicEnabled;
  updateMusicButton();
  if(musicEnabled) await playOpeningMusic();
  else {openingMusic.pause();$("musicStatus").textContent="Música pausada.";}
});
// A primeira interação do visitante libera o áudio se o navegador o tiver bloqueado.
// Não retoma quando o usuário apertou PAUSAR MÚSICA.
document.addEventListener("pointerdown",event=>{
  if(event.target.closest("#musicButton")) return;
  if(musicEnabled && $("attractScreen").classList.contains("visible") && openingMusic.paused)
    void playOpeningMusic();
}, {capture:true});
document.addEventListener("keydown",()=>{
  if(musicEnabled && $("attractScreen").classList.contains("visible") && openingMusic.paused)
    void playOpeningMusic();
});
updateMusicButton();
function showAttract() {
  stopGameMusic();
  $("cameraSetupPanel").hidden=true;
  $("attractPrompt").textContent=cameraReady
    ? "✋ MOSTRE A MÃO ABERTA PARA JOGAR"
    : "CONFIGURE A CÂMERA PARA JOGAR COM A MÃO ABERTA";
  $("attractInstruction").hidden=!cameraReady;
  hideCelebration();
  setState("attract");
  $("attractScreen").classList.add("visible");
  $("attractScreen").setAttribute("aria-hidden","false");
  $("attractFill").style.width="0%";
  playOpeningMusic();
}
function hideAttract() {
  openingMusic.pause();
  $("attractScreen").classList.remove("visible");
  $("attractScreen").setAttribute("aria-hidden","true");
}
function hideCelebration() {
  $("celebration").classList.remove("visible");
  $("celebration").setAttribute("aria-hidden","true");
}
function dots() {
  $("roundDots").textContent=Array.from({length:5},(_,i)=>i<round-1?"●":"○").join(" ");
}


function setState(next) {
  state = next; stateSince = performance.now();
  if(next==="ready") {
    lastHandSeenAt=stateSince;
    $("notice").classList.remove("inactivityWarning");
    $("notice").textContent=defaultNotice;
  }
  $("headline").classList.toggle("countdown",next==="countdown"||next==="capture"); candidate = ""; candidateSince = 0;
  $("progressFill").style.width = "0%";
}
function message(head, instruction, progress) {
  $("headline").textContent = head;
  $("instruction").textContent = instruction;
  $("progressText").textContent = progress;
}
function progress(value) {
  $("progressFill").style.width = `${Math.min(100,Math.max(0,value*100))}%`;
}
function score() {
  $("humanScore").textContent = scoreHuman;
  $("cpuScore").textContent = scoreCpu;
  $("roundLabel").textContent = `RODADA ${Math.min(round,5)} / 5`;
}
function reset() {
  scoreHuman = 0; scoreCpu = 0; round = 1; score(); hideCpu(); hideCelebration(); hideAttract(); tone(660,.2);
  $("notice").textContent="Dica: posicione uma mão inteira dentro do enquadramento.";
  void playGameMusic();
  setState("ready");
  message("PARTIDA INICIADA!", "Mostre o punho fechado ✊ por 2 segundos.", "Aguardando punho fechado...");
}
function hideCpu() { $("cpuHand").textContent = "❔"; $("cpuChoice").textContent = "Escolha oculta"; }
function startCountdown(now) {
  // A escolha do JARVIS é definida ANTES de revelar o gesto do jogador.
  cpuMove = choices[Math.floor(Math.random()*3)];
  hideCpu(); countdownStart = now; captured = false;
  lastCountdownNumber=null;
  setState("countdown");
  message("3", "Prepare seu gesto!", "Pedra, papel ou tesoura no JÁ!");
}
function compare(human,cpu) {
  if (human === cpu) return 0;
  if ((human==="pedra"&&cpu==="tesoura") ||
      (human==="papel"&&cpu==="pedra") ||
      (human==="tesoura"&&cpu==="papel")) return 1;
  return -1;
}
function play(human) {
  captured = true;
  const result = compare(human,cpuMove);
  if(result===1) scoreHuman++;
  if(result===-1) scoreCpu++;
  $("cpuHand").textContent = symbols[cpuMove];
  $("cpuChoice").textContent = titles[cpuMove];
  score();
  $("cpuHand").classList.remove("reveal");
  void $("cpuHand").offsetWidth;
  $("cpuHand").classList.add("reveal");
  soundResult(result);
  const resultText = result===0 ? "EMPATE!" : result===1 ? "VOCÊ VENCEU!" : "JARVIS VENCEU!";
  message(resultText, `Você: ${titles[human]} ${symbols[human]}  ×  JARVIS: ${titles[cpuMove]} ${symbols[cpuMove]}`, "Resultado da rodada");
  setState("result");
}
function endRound() {
  // Encerra antes da quinta rodada se o adversário já não puder
  // alcançar nem empatar o placar, mesmo vencendo todas as restantes.
  const remainingRounds = 5 - round;
  const decided = Math.abs(scoreHuman - scoreCpu) > remainingRounds;
  if(round===5 || decided) {
    // A trilha da partida continua durante os 30 segundos do resultado.
    // A troca para a música de abertura acontece apenas em showAttract().
    const winner = scoreHuman===scoreCpu ? "PARTIDA EMPATADA!" :
      scoreHuman>scoreCpu ? "ESTUDANTE VENCEU!" : "JARVIS VENCEU!";
    setState("finished");
    message(winner, `Placar final: ${scoreHuman} × ${scoreCpu}`, "Tela inicial em 30 segundos.");
    celebrate(winner);
    tone(784,.25);tone(988,.28,"sine",.25);
  } else {
    round++; score(); hideCpu(); setState("ready");
    message("PRÓXIMA RODADA", "Mostre o punho fechado ✊ por 2 segundos.", "Aguardando punho fechado...");
  }
}
function hold(gesture,expected,ms,now,onComplete) {
  if(gesture!==expected) { candidate=""; candidateSince=0; progress(0); return; }
  if(candidate!==expected) { candidate=expected; candidateSince=now; }
  const elapsed=now-candidateSince; progress(elapsed/ms);
  if(elapsed>=ms) onComplete();
}
function dist(a,b) {return Math.hypot(a.x-b.x,a.y-b.y);}
function classify(lm) {
  // Compara a distância da ponta do dedo ao punho com a distância
  // da articulação intermediária ao punho; funciona com a mão rotacionada.
  const wrist=lm[0];
  const fingers=[[8,6],[12,10],[16,14],[20,18]];
  const extended=fingers.map(([tip,pip])=>dist(lm[tip],wrist)>dist(lm[pip],wrist)*1.12);
  const [index,middle,ring,pinky]=extended;
  if(index&&middle&&ring&&pinky) return "papel";
  if(!index&&!middle&&!ring&&!pinky) return "pedra";
  if(index&&middle&&!ring&&!pinky) return "tesoura";
  return null;
}
function updateGame(gesture,now) {
  dots();
  if(updateInactivity(now)) return;
  $("gestureLabel").textContent = gesture ? `${symbols[gesture]} ${titles[gesture]}` : "Gesto não identificado";
  if(state==="finished") {
    // Durante os 30 segundos, a mão aberta também pode iniciar outra partida.
    hold(gesture,"papel",HOLD_START,now,reset);
    const remaining=Math.max(0,Math.ceil((RESULT_DISPLAY_MS-(now-stateSince))/1000));
    $("returnSeconds").textContent=String(remaining);
    if(state==="finished" && now-stateSince>=RESULT_DISPLAY_MS) showAttract();
  } else if(state==="waiting" || state==="attract") {
    hold(gesture,"papel",HOLD_START,now,reset);
    if(state==="attract") $("attractFill").style.width=$("progressFill").style.width;
  } else if(state==="ready") {
    hold(gesture,"pedra",HOLD_READY,now,()=>startCountdown(now));
  } else if(state==="countdown") {
    const elapsed=now-countdownStart;
    if(elapsed<3000) {
      const remaining=3-Math.floor(elapsed/1000);
      $("headline").textContent=String(remaining);
      if(lastCountdownNumber!==remaining) {
        lastCountdownNumber=remaining;
        tone(remaining===1?650:450,.12);
        $("headline").classList.remove("flash");
        void $("headline").offsetWidth;
        $("headline").classList.add("flash");
      }
      $("progressText").textContent="Mostre sua escolha quando aparecer JÁ!";
      progress(elapsed/3000);
    } else {
      tone(880,.3,"square");
      setState("capture");
      message("JÁ!", "Escolha pedra, papel ou tesoura! Você tem 5 segundos.", "Prepare o gesto e mantenha-o por um instante.");
    }
  } else if(state==="capture") {
    const elapsed=now-stateSince;
    const remaining=Math.max(0,Math.ceil((CAPTURE_WINDOW_MS-elapsed)/1000));
    $("progressText").textContent=`JÁ! Faça sua escolha — ${remaining}s`;
    // Evita registrar a mão ainda fechada da contagem antes de o aluno reagir.
    if(elapsed<CAPTURE_GRACE_MS) {
      candidate=""; candidateSince=0; progress(elapsed/CAPTURE_WINDOW_MS);
    } else if(gesture && choices.includes(gesture)) {
      if(candidate!==gesture) {candidate=gesture;candidateSince=now;}
      progress(elapsed/CAPTURE_WINDOW_MS);
      if(now-candidateSince>=STABLE_CAPTURE) play(gesture);
    } else {candidate="";candidateSince=0;progress(elapsed/CAPTURE_WINDOW_MS);}
    // Se nenhum gesto for reconhecido, não dar ponto ao JARVIS:
    // repetir a oportunidade de escolha na mesma rodada.
    if(state==="capture" && elapsed>=CAPTURE_WINDOW_MS) {
      setState("ready");
      message("GESTO NÃO IDENTIFICADO", "Mostre o punho fechado ✊ por 2 segundos para tentar novamente.", "Rodada mantida, sem pontuação.");
      progress(0);
    }
  } else if(state==="result") {
    progress(0);
    if(now-stateSince>=2600) endRound();
  }
}
// Lista e troca de webcams sem reiniciar o navegador nem carregar a IA novamente.
let switchingCamera=false, cameraReady=false;
async function listCameras() {
  const select=$("cameraSelect");
  if(!navigator.mediaDevices?.enumerateDevices) return;
  const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==="videoinput");
  const activeId=stream?.getVideoTracks()[0]?.getSettings()?.deviceId;
  const selected=activeId || select.value;
  select.replaceChildren();
  if(!devices.length) {
    select.add(new Option("Nenhuma câmera encontrada","")); select.disabled=true;return;
  }
  devices.forEach((d,i)=>select.add(new Option(d.label||`Câmera ${i+1}`,d.deviceId)));
  if(devices.some(d=>d.deviceId===selected)) select.value=selected;
  select.disabled=!cameraReady;
  const setup=$("setupCameraSelect");
  const prior=setup.value || requestedCameraId || selected;
  setup.replaceChildren(new Option("Câmera padrão",""));
  devices.forEach((d,i)=>setup.add(new Option(d.label||`Câmera ${i+1}`,d.deviceId)));
  if(devices.some(d=>d.deviceId===prior)) setup.value=prior;
}
async function openCamera(deviceId=null) {
  const constraints={audio:false,video:{width:{ideal:960},height:{ideal:720},...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:"user"})}};
  const next=await navigator.mediaDevices.getUserMedia(constraints);
  const previous=stream;
  try {
    video.srcObject=next;
    await video.play();
    stream=next;
    canvas.width=video.videoWidth;canvas.height=video.videoHeight;
    lastVideoTime=-1;lastGesture=null;handPresent=false;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(previous && previous!==next) previous.getTracks().forEach(t=>t.stop());
  } catch(err) {
    next.getTracks().forEach(t=>t.stop());
    video.srcObject=previous||null;
    if(previous) await video.play().catch(()=>{});
    throw err;
  }
}
async function changeCamera(id) {
  if(!cameraReady || switchingCamera || !id) return;
  switchingCamera=true;
  $("cameraSelect").disabled=true;
  $("cameraStatus").textContent="Trocando câmera...";
  try {
    await openCamera(id);
    // Reinicia a partida para não registrar gestos acidentais durante a troca.
    scoreHuman=0;scoreCpu=0;round=1;score();hideCpu();hideCelebration();hideAttract();
    setState("waiting");
    message("CÂMERA ALTERADA", "Mostre a mão aberta ✋ por 3 segundos.", "Aguardando gesto de início...");
    $("cameraStatus").textContent="● Câmera ativa";
  } catch(err) {
    console.error("Erro ao trocar webcam:",err);
    $("cameraStatus").textContent="Falha ao trocar câmera";
    $("notice").textContent=`Não foi possível trocar a câmera: ${err.message}`;
  } finally {
    cameraReady=true;switchingCamera=false;
    await listCameras().catch(console.warn);
  }
}
$("cameraSelect").addEventListener("change",e=>changeCamera(e.target.value));
$("refreshCameras").addEventListener("click",async()=>{
  try {await listCameras();}catch(err){$("notice").textContent="Erro ao listar câmeras: "+err.message;}
});
if(navigator.mediaDevices?.addEventListener) navigator.mediaDevices.addEventListener("devicechange",()=>listCameras().catch(console.warn));

async function activateCamera() {
  const button=$("cameraButton");
  button.disabled=true; button.textContent="ABRINDO CÂMERA...";
  try {
    if(!navigator.mediaDevices?.getUserMedia) throw new Error("Use Live Server (localhost) ou HTTPS. Abrir o arquivo diretamente não é recomendado.");
    await openCamera(requestedCameraId);
    await listCameras().catch(console.warn);
    $("cameraStatus").textContent="● Câmera ativa";
    button.textContent="CARREGANDO IA...";
    message("CÂMERA ATIVA", "Carregando o reconhecimento de gestos...", "Aguarde alguns segundos.");
    // Biblioteca instalada localmente: nenhum CDN é necessário ao jogar.
    const visionModule = await import("./vendor/vision_bundle.mjs");
    const wasmBase = "./vendor/wasm";
    ({HandLandmarker,FilesetResolver,DrawingUtils}=visionModule);
    const vision=await FilesetResolver.forVisionTasks(
      wasmBase
    );
    async function makeLandmarker(delegate) {
      return HandLandmarker.createFromOptions(vision,{
        baseOptions:{
          modelAssetPath:"./vendor/hand_landmarker.task",
          delegate
        },
        runningMode:"VIDEO",numHands:1,
        minHandDetectionConfidence:0.65,
        minHandPresenceConfidence:0.65,
        minTrackingConfidence:0.6
      });
    }
    try {landmarker=await makeLandmarker("GPU");}
    catch(gpuError) {
      console.warn("GPU indisponível, tentando CPU:",gpuError);
      landmarker=await makeLandmarker("CPU");
    }
    drawing=new DrawingUtils(ctx);
    cameraReady=true;
    await listCameras().catch(console.warn);
    button.style.display="none";
    try {audioCtx = new (window.AudioContext||window.webkitAudioContext)();await audioCtx.resume();} catch(e) {console.warn("Áudio não disponível",e);}
    if(startAfterCamera) reset();
    else showAttract();
    startAfterCamera=false;
    $("setupStatus").textContent="Câmera e IA prontas!";
    requestAnimationFrame(loop);
  } catch(err) {
    console.error("Falha na inicialização:",err);
    $("cameraStatus").textContent=stream ? "Câmera ativa · IA indisponível" : "Erro na câmera";
    message("ERRO AO INICIAR",err.message || "Verifique a webcam e a conexão com a internet.","Confira a mensagem e tente novamente.");
    button.disabled=false;button.textContent="TENTAR NOVAMENTE";
    $("setupStatus").textContent="Erro: "+(err.message||"Não foi possível ativar.");
    $("attractPrompt").textContent="VERIFIQUE A CÂMERA E TENTE NOVAMENTE";
    startAfterCamera=false;
  }
}

function loop(now) {
  if(!landmarker || switchingCamera || video.readyState<2) {requestAnimationFrame(loop);return;}
  // Não processar o mesmo quadro duas vezes.
  if(video.currentTime!==lastVideoTime) {
    lastVideoTime=video.currentTime;
    const result=landmarker.detectForVideo(video,now);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const lm=result.landmarks?.[0];
    handPresent=Boolean(lm);
    lastGesture=lm ? classify(lm) : null;
    if(lm) {
      drawing.drawConnectors(lm,HandLandmarker.HAND_CONNECTIONS,{color:"#42dfbb",lineWidth:3});
      drawing.drawLandmarks(lm,{color:"#f5faff",radius:3});
    }
  }
  // Atualiza também durante intervalos sem novo quadro da câmera.
  if(now-lastTick>=40) {updateGame(lastGesture,now);lastTick=now;}
  requestAnimationFrame(loop);
}
$("cameraButton").addEventListener("click",activateCamera);
score();


$("soundButton").addEventListener("click",async()=>{
  soundOn=!soundOn;
  $("soundButton").textContent=soundOn?"🔊 SOM LIGADO":"🔇 SOM DESLIGADO";
  $("soundButton").setAttribute("aria-pressed",String(soundOn));
  if(soundOn && audioCtx) {await audioCtx.resume();tone(700,.15);}
});
$("fullButton").addEventListener("click",async()=>{
  try {
    if(!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch(err) {console.warn("Tela cheia indisponível:",err);}
});


// Comandos da tela de atração: funcionam mesmo antes da primeira autorização da webcam.
$("configureCameraButton").addEventListener("click",async()=>{
  $("cameraSetupPanel").hidden=false;
  try {await listCameras();} catch(err) {$("setupStatus").textContent="Não foi possível listar câmeras: "+err.message;}
});
$("setupCloseButton").addEventListener("click",()=>{$("cameraSetupPanel").hidden=true;});
$("setupCameraSelect").addEventListener("change",e=>{requestedCameraId=e.target.value||null;});
$("setupActivateButton").addEventListener("click",async()=>{
  requestedCameraId=$("setupCameraSelect").value||null;
  $("setupStatus").textContent="Ativando câmera e reconhecimento...";
  if(cameraReady) {
    if(requestedCameraId) await changeCamera(requestedCameraId);
    showAttract();
    $("setupStatus").textContent="Câmera pronta!";
  } else {
    startAfterCamera=false;
    await activateCamera();
  }
});
// Mostrar a tela animada já na abertura, antes da webcam.
showAttract();

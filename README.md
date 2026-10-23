# Jokenpô IA — JARVIS | Início apenas por gesto

- A abertura agora exibe **somente CONFIGURAR CÂMERA**; a arte foi atualizada para não mostrar INICIAR.
- Configure/ative a câmera pelo botão central da abertura.
- Depois, mostre **mão aberta por 3 segundos** para iniciar uma partida.
- Após as cinco rodadas, a mão aberta por 3 segundos inicia outra partida durante os 30 segundos do resultado. Sem gesto, retorna à abertura e continua aguardando a mão aberta.
- Música: copie seu `musica-abertura.mp3` para a mesma pasta do `index.html`.
- MediaPipe: copie a pasta `vendor` da versão anterior.
- Execute com Live Server.
- O botão `♫ ATIVAR MÚSICA` permanece no canto superior direito.

O JavaScript foi verificado sintaticamente, mas o fluxo precisa ser testado com a webcam.

## Tempo do JÁ ampliado
- Após 3–2–1, a tela JÁ permanece até 5 segundos aguardando a escolha.
- Há 1,2 segundo inicial para mudar do punho fechado para pedra, papel ou tesoura.
- O gesto deve permanecer estável por 0,65 segundo.
- Se nenhum gesto for reconhecido dentro da janela, a mesma rodada pode ser tentada novamente, sem pontuar.
- A arena, abertura, câmera e música foram mantidas.

## Música durante a partida
Coloque na mesma pasta do `index.html` os dois arquivos de áudio:
- `musica-abertura.mp3` — toca em loop na tela inicial, depois que o navegador permitir áudio.
- `back-in-black.mp3` — toca em loop durante as cinco rodadas, pausa ao mostrar o vencedor.

Os arquivos de áudio não são incluídos no ZIP. Utilize seus próprios arquivos autorizados.
O navegador pode bloquear a reprodução iniciada apenas por gesto: se isso acontecer, clique em `ATIVAR MÚSICA` na abertura e configure a câmera antes de começar.

## Música automática na abertura
- A música `musica-abertura.mp3` é habilitada por padrão e tenta começar ao carregar a tela.
- Botão `♫ PAUSAR MÚSICA` interrompe a abertura; `♫ RETOMAR MÚSICA` volta a reproduzir.
- A pausa manual permanece válida nos retornos à abertura até o usuário retomar.
- Se o navegador bloquear o autoplay com som, basta uma interação inicial na tela.
- `back-in-black.mp3` continua tocando em loop durante a partida, como na versão anterior.

## Música durante o resultado final
- `back-in-black.mp3` segue tocando durante o anúncio do vencedor (até 30 segundos).
- Só para ao retornar à tela inicial, quando `musica-abertura.mp3` volta.
- Se o estudante reiniciar por gesto antes dos 30 segundos, a trilha da partida reinicia na nova partida.

## Tela do vencedor
- Mensagem em destaque: **MOSTRE A MÃO ABERTA PARA JOGAR NOVAMENTE**.
- Instrução: manter a palma aberta por 3 segundos.
- Após 30 segundos sem gesto, retorna à abertura.
- A música da partida continua tocando durante o resultado.

## Destaque do vencedor
O resultado final agora exibe o vencedor em letras grandes e placar 0 × 0 com números destacados, preservando a instrução de mão aberta, os 30 segundos e a trilha musical.

Resultado final: visual simplificado aprovado, vencedor e placar grandes na mesma linha. Músicas e vendor devem ser copiados da versão anterior.

Arena: placar ampliado, painéis de câmera e JARVIS reduzidos, holograma dourado inspirado na imagem aprovada. A câmera real permanece funcional. Copie vendor/ e os MP3s da versão anterior.

Arena fiel ao anexo: moldura HUD ciano, placar superior ampliado, holograma dourado e quadros menores. Elementos continuam dinâmicos.

Atualização: holograma JARVIS substituído pelo PNG transparente aprovado, sem alterar os comandos, sons ou placar.

## Retorno automático por inatividade
Se a câmera não detectar nenhuma mão por 45 segundos enquanto o jogo aguarda o punho fechado, retorna à tela inicial e troca a música automaticamente. Nos últimos 10 segundos aparece aviso de contagem regressiva. Qualquer mão visível reinicia o temporizador. O temporizador não interrompe a contagem 3–2–1, o JÁ, o resultado da rodada ou a tela do vencedor (que mantém seus 30 segundos).

## Vitória antecipada
A partida termina após a rodada atual quando a diferença de pontos é maior
que o número de rodadas restantes (ex.: 3×0 após 3 rodadas ou 3×1 após 4).
Se ainda houver chance de empate ou virada, continua até a quinta rodada.
A tela do vencedor, o áudio e o retorno de 30 segundos foram preservados.

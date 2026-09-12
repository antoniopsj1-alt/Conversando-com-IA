const btnEnviar = document.getElementById("btnEnviar");
const btnLimpar = document.getElementById("btnLimpar");

const promptInput = document.getElementById("prompt");
const resultado = document.getElementById("resultado");
const status = document.querySelector(".status-text");

/* =========================
   RECONHECIMENTO DE VOZ
========================= */

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let recognition = null;
let gravando = false;

if (SpeechRecognition) {

    recognition = new SpeechRecognition();

    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {

        gravando = true;

        atualizarStatus(
            "Gravando áudio..."
        );
    };

    recognition.onresult = (event) => {

        let texto = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            texto +=
                event.results[i][0].transcript + " ";
        }

        promptInput.value =
            texto.trim();
    };

    recognition.onerror = (event) => {

        console.error(event);

        atualizarStatus(
            "Erro ao gravar áudio."
        );
    };

    recognition.onend = () => {

        gravando = false;

        atualizarStatus(
            "Gravação encerrada."
        );
    };
}

/* =========================
   FUNÇÕES
========================= */

function atualizarStatus(texto) {

    if (status) {

        status.textContent =
            texto;
    }
}

function formatarResposta(texto) {

    return String(texto || "")

        .replace(/```[\s\S]*?```/g, "")
        .replace(/```/g, "")

        .replace(/^#+\s*/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/_(.*?)_/g, "$1")
        .replace(/`(.*?)`/g, "$1")

        .replace(/^\s*[-*•]\s*/gm, "• ")

        .replace(/\|/g, " ")
        .replace(/>/g, " ")
        .replace(/\[/g, "")
        .replace(/\]/g, "")

        .replace(/\n{3,}/g, "\n\n")

        .trim();
}

/* =========================
   ENVIAR PARA IA
========================= */

btnEnviar?.addEventListener(
    "click",
    async () => {

        const pergunta =
            promptInput.value.trim();

        if (!pergunta) {

            atualizarStatus(
                "Digite uma pergunta."
            );

            return;
        }

        try {

            if (
                typeof puter ===
                "undefined"
            ) {

                throw new Error(
                    "Puter não carregado."
                );
            }

            atualizarStatus(
                "A IA está pensando..."
            );

            resultado.innerHTML =
                "Processando...";

            const resposta =
                await puter.ai.chat(
                    pergunta
                );

            const texto =
                resposta?.message?.content ||
                resposta?.content ||
                String(resposta || "");

            	resultado.textContent =
    		formatarResposta(texto);

            atualizarStatus(
                "Resposta recebida."
            );

        } catch (erro) {

            console.error(erro);

            atualizarStatus(
                "Erro ao consultar IA."
            );

            resultado.innerHTML =
                `Erro: ${erro.message || erro}`;
        }

    }
);

/* =========================
   LIMPAR
========================= */

btnLimpar?.addEventListener(
    "click",
    () => {

        promptInput.value = "";

        resultado.innerHTML =
            "Sua resposta aparecerá aqui.";

        atualizarStatus(
            "Limpo."
        );
    }
);

/* =========================
   GRAVAR ÁUDIO
========================= */

document
    .getElementById("btnGravar")
    ?.addEventListener(
        "click",
        () => {

            if (!recognition) {

                atualizarStatus(
                    "Reconhecimento de voz não suportado."
                );

                return;
            }

            try {

                recognition.start();

            } catch (erro) {

                console.error(
                    erro
                );
            }
        }
    );

/* =========================
   PARAR TUDO
========================= */

document
    .getElementById("btnParar")
    ?.addEventListener(
        "click",
        () => {

            if (
                recognition &&
                gravando
            ) {

                recognition.stop();
            }

            speechSynthesis.cancel();

            atualizarStatus(
                "Gravação e leitura interrompidas."
            );
        }
    );

/* =========================
   OUVIR PEDIDO
========================= */

document
    .getElementById("btnLerTexto")
    ?.addEventListener(
        "click",
        () => {

            const texto =
                promptInput.value.trim();

            if (!texto) return;

            speechSynthesis.cancel();

            const fala =
                new SpeechSynthesisUtterance(
                    texto
                );

            fala.lang = "pt-BR";

            speechSynthesis.speak(
                fala
            );

            atualizarStatus(
                "Lendo pedido..."
            );
        }
    );

/* =========================
   OUVIR RESPOSTA
========================= */

document
.getElementById("btnLerResposta")
?.addEventListener(
        "click",
        () => {

            const texto =
    	resultado.innerText

        .replace(/#/g, "")
        .replace(/\*/g, "")
        .replace(/_/g, "")
        .replace(/`/g, "")
        .replace(/\|/g, " ")
        .replace(/\s+/g, " ")

        .trim();

           if (!texto) return;

           speechSynthesis.cancel();
            const fala =
               new SpeechSynthesisUtterance(
                    texto
               );

            fala.lang = "pt-BR";

            speechSynthesis.speak(
               fala
            );
            atualizarStatus(
              "Lendo resposta..."
            );        }
    );

/* =========================
   PAUSAR RESPOSTA
========================= */

document  .getElementById("btnPausarResposta")
   ?.addEventListener(
       "click",
       () => {

           speechSynthesis.pause()

           atualizarStatus(
               "Áudio pausado."
           );
       }
   );

/* =========================
   CONTINUAR RESPOSTA
========================= */

document
    .getElementById("btnContinuarResposta")
    ?.addEventListener(
        "click",
        () => {

            if (speechSynthesis.paused) {

                speechSynthesis.resume();

                atualizarStatus(
                    "Áudio retomado."
                );

            } else {

                atualizarStatus(
                    "Não existe áudio pausado."
                );
            }
        }
    );

/* =========================
   PARAR RESPOSTA
========================= */

document
    .getElementById("btnPararResposta")
    ?.addEventListener(
        "click",
        () => {

            speechSynthesis.cancel();

            atualizarStatus(
                "Leitura encerrada."
            );

        }
    );

/* =========================
   Copiar Resposta
========================= */

document
    .getElementById("btnCopiarResposta")
    ?.addEventListener(
        "click",
        async () => {

            const texto =
                resultado.innerText;

            if (!texto) {

                atualizarStatus(
                    "Não há texto para copiar."
                );

                return;
            }

            try {

                await navigator.clipboard.writeText(
                    texto
                );

                atualizarStatus(
                    "Texto copiado para a área de transferência."
                );

            } catch (erro) {

                console.error(erro);

                atualizarStatus(
                    "Erro ao copiar texto."
                );
            }

        }
    );
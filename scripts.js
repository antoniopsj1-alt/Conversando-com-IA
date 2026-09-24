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

function escaparHtml(texto) {
    return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Converte o Markdown retornado pela IA em HTML estruturado (títulos, listas,
 * negrito, código, parágrafos), preservando trechos de fórmula ($$...$$, $...$,
 * \[...\], \(...\)) intactos para o MathJax renderizar depois.
 */
function formatarResposta(textoOriginal) {

    const texto = String(textoOriginal || "").replace(/\r\n/g, "\n").trim();
    if (!texto) return "";

    // 1) Protege blocos de código ```...``` (não devem virar Markdown nem perder espaços)
    const blocosCodigo = [];
    let semCodigo = texto.replace(/```([a-zA-Z0-9]*)\n?([\s\S]*?)```/g, (match, lang, codigo) => {
        const token = `@@CODEBLOCK${blocosCodigo.length}@@`;
        blocosCodigo.push(`<pre><code>${escaparHtml(codigo.trim())}</code></pre>`);
        return `\n${token}\n`;
    });

    // 2) Protege fórmulas (display $$...$$ / \[...\] e inline $...$ / \(...\))
    //    para que negrito/itálico não interfiram nos símbolos usados pelo LaTeX.
    const formulas = [];
    const protegerFormula = (match) => {
        const token = `@@FORMULA${formulas.length}@@`;
        formulas.push(match);
        return token;
    };
    semCodigo = semCodigo
        .replace(/\$\$[\s\S]*?\$\$/g, protegerFormula)
        .replace(/\\\[[\s\S]*?\\\]/g, protegerFormula)
        .replace(/\\\([\s\S]*?\\\)/g, protegerFormula)
        .replace(/\$[^\n$]+\$/g, protegerFormula);

    // 3) Escapa HTML do restante (fora de código/fórmulas já protegidos)
    let escapado = escaparHtml(semCodigo);

    // 4) Formatação inline: negrito, itálico, código inline
    escapado = escapado
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/__(.+?)__/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*(?!\*)([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
        .replace(/`([^`\n]+)`/g, "<code>$1</code>");

    // 5) Processa linha a linha: cabeçalhos, listas e parágrafos
    const linhas = escapado.split("\n");
    const html = [];
    let listaAtual = null; // "ul" | "ol" | null
    let paragrafoAtual = [];

    const fecharParagrafo = () => {
        if (paragrafoAtual.length) {
            html.push(`<p>${paragrafoAtual.join("<br>")}</p>`);
            paragrafoAtual = [];
        }
    };

    const fecharLista = () => {
        if (listaAtual) {
            html.push(`</${listaAtual}>`);
            listaAtual = null;
        }
    };

    linhas.forEach((linhaRaw) => {
        const linha = linhaRaw.trim();

        if (!linha) {
            fecharParagrafo();
            fecharLista();
            return;
        }

        const cabecalho = linha.match(/^(#{1,4})\s+(.*)$/);
        if (cabecalho) {
            fecharParagrafo();
            fecharLista();
            const nivel = cabecalho[1].length;
            html.push(`<h${nivel}>${cabecalho[2].trim()}</h${nivel}>`);
            return;
        }

        if (/^(-{3,}|\*{3,})$/.test(linha)) {
            fecharParagrafo();
            fecharLista();
            html.push("<hr>");
            return;
        }

        const itemNaoOrdenado = linha.match(/^[-*•]\s+(.*)$/);
        const itemOrdenado = linha.match(/^\d+[.)]\s+(.*)$/);

        if (itemNaoOrdenado) {
            fecharParagrafo();
            if (listaAtual !== "ul") {
                fecharLista();
                html.push("<ul>");
                listaAtual = "ul";
            }
            html.push(`<li>${itemNaoOrdenado[1]}</li>`);
            return;
        }

        if (itemOrdenado) {
            fecharParagrafo();
            if (listaAtual !== "ol") {
                fecharLista();
                html.push("<ol>");
                listaAtual = "ol";
            }
            html.push(`<li>${itemOrdenado[1]}</li>`);
            return;
        }

        const marcadorCodigo = linha.match(/^@@CODEBLOCK(\d+)@@$/);
        if (marcadorCodigo) {
            fecharParagrafo();
            fecharLista();
            html.push(linha);
            return;
        }

        fecharLista();
        paragrafoAtual.push(linha);
    });

    fecharParagrafo();
    fecharLista();

    let resultado = html.join("\n");

    // 6) Restaura blocos de código e fórmulas nos lugares originais
    resultado = resultado.replace(/@@CODEBLOCK(\d+)@@/g, (m, i) => blocosCodigo[Number(i)]);
    resultado = resultado.replace(/@@FORMULA(\d+)@@/g, (m, i) => formulas[Number(i)]);

    return resultado;
}

/**
 * Pede ao MathJax para renderizar as fórmulas presentes no elemento informado.
 * Seguro de chamar mesmo se o MathJax ainda não tiver terminado de carregar.
 */
async function renderizarFormulas(elemento) {
    try {
        if (window.MathJax && typeof MathJax.typesetPromise === "function") {
            await MathJax.typesetPromise([elemento]);
        }
    } catch (erro) {
        console.error("Erro ao renderizar fórmulas com MathJax:", erro);
    }
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

            const instrucoesFormatacao = `
Responda de forma bem estruturada, em Markdown, usando títulos (##), subtítulos, parágrafos curtos e listas quando fizer sentido para organizar a explicação (não force estrutura em respostas simples, como uma saudação).

Quando houver fórmulas ou equações de matemática, física ou química:

- Utilize símbolos matemáticos Unicode no texto corrido.
- Exemplos corretos:
  2x² − 2x + 1 = 0
  x³ + 2x² − x = 0
  √25 = 5
  Δ = b² − 4ac
  F = m·a
  H₂O, CO₂, H₂SO₄

- Não escreva:
  2x^2-2x+1=0
  x^3+2x^2-x=0
  sqrt(25)=5
  Delta=b^2-4ac
  H2O, CO2

Quando houver equações do 2º grau, apresente SEMPRE:

Forma geral:
ax² + bx + c = 0

Discriminante:
Δ = b² − 4ac

Fórmula de Bhaskara:

$$
x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}
$$

Para fórmulas mais complexas (frações, raízes, integrais, matrizes, equações químicas balanceadas etc.), utilize sempre notação LaTeX entre $$ $$ (fórmula em destaque, numa linha própria) ou entre $ $ (fórmula dentro do texto).

Regras obrigatórias:

- Sempre que houver fórmulas, use LaTeX ($$...$$ ou $...$) ou Unicode matemático.
- Nunca converta fórmulas para texto simples sem formatação.
- Não escrever x^2. Escreva x².
- Não escrever Delta. Escreva Δ.
- Não escrever sqrt. Escreva √.
`;

const resposta = await puter.ai.chat(
    `${instrucoesFormatacao}\n\nPergunta do usuário:\n${pergunta}`
);

            const texto =
                resposta?.message?.content ||
                resposta?.content ||
                String(resposta || "");

            	resultado.innerHTML =
    		formatarResposta(texto);

            await renderizarFormulas(resultado);

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
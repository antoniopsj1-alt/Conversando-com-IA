const btnEnviar = document.getElementById("btnEnviar");
const btnLimpar = document.getElementById("btnLimpar");
const btnLimparHistorico = document.getElementById("btnLimparHistorico");
const btnAnexar = document.getElementById("btnAnexar");
const btnCopiarHistorico = document.getElementById("btnCopiarHistorico");
const promptInput = document.getElementById("prompt");
const resultado = document.getElementById("resultado");
const status = document.querySelector(".status-text");
const historicoLista = document.getElementById("historicoLista");
const fileAnexo = document.getElementById("fileAnexo");
const anexoPreview = document.getElementById("anexoPreview");

/* =========================
   ANEXO (ARQUIVO OU FOTO)
   A IA do Puter só "enxerga" o conteúdo de um arquivo se ele for
   enviado pelo sistema de arquivos do Puter (puter.fs). Por isso,
   ao anexar, o arquivo é enviado para lá, usado na pergunta e
   apagado logo em seguida.
========================= */

const TAMANHO_MAX_ANEXO = 20 * 1024 * 1024; // 20MB

let arquivoAnexado = null; // objeto File escolhido pelo usuário

function formatarTamanho(bytes) {

    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";

    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function iconeParaArquivo(nome) {

    const ext = (nome.split(".").pop() || "").toLowerCase();

    if (["pdf"].includes(ext)) return "📕";
    if (["doc", "docx"].includes(ext)) return "📄";
    if (["txt"].includes(ext)) return "📃";

    return "📎";
}

function renderizarAnexoPreview() {

    if (!arquivoAnexado) {

        anexoPreview.style.display = "none";
        anexoPreview.innerHTML = "";

        return;
    }

    const ehImagem = arquivoAnexado.type.startsWith("image/");

    const miniatura = ehImagem
        ? `<img src="${URL.createObjectURL(arquivoAnexado)}" alt="">`
        : `<span class="anexo-icone">${iconeParaArquivo(arquivoAnexado.name)}</span>`;

    anexoPreview.style.display = "flex";

    anexoPreview.innerHTML = `
        ${miniatura}
        <div class="anexo-info">
            <div class="anexo-nome">${escaparHtml(arquivoAnexado.name)}</div>
            <div class="anexo-tam">${formatarTamanho(arquivoAnexado.size)}</div>
        </div>
        <button type="button" class="anexo-remover" id="btnRemoverAnexo">✕ Remover</button>
    `;

    document
        .getElementById("btnRemoverAnexo")
        ?.addEventListener("click", () => {

            arquivoAnexado = null;
            fileAnexo.value = "";

            renderizarAnexoPreview();
        });
}

btnAnexar?.addEventListener(
    "click",
    () => fileAnexo.click()
);

fileAnexo?.addEventListener(
    "change",
    () => {

        const arquivo = fileAnexo.files?.[0];

        if (!arquivo) return;

        if (arquivo.size > TAMANHO_MAX_ANEXO) {

            atualizarStatus(
                "Arquivo muito grande (máximo 20MB)."
            );

            fileAnexo.value = "";

            return;
        }

        arquivoAnexado = arquivo;

        renderizarAnexoPreview();

        atualizarStatus(
            "Arquivo pronto para enviar junto com a pergunta."
        );
    }
);

/* =========================
   MEMÓRIA DA CONVERSA
   (o Puter não guarda histórico sozinho: é preciso reenviar
   as mensagens anteriores a cada nova pergunta)
========================= */

// Quantidade máxima de pares pergunta/resposta reenviados à IA a cada
// pergunta nova (evita que a conversa cresça demais e fique lenta/cara).
const MAX_PARES_MEMORIA = 10;

// Histórico enviado à IA: [{role:"user"|"assistant", content:"..."}]
let historicoIA = [];

// Histórico mostrado na tela (guarda o texto completo da resposta para
// poder reabrir qualquer item depois, mesmo os mais antigos).
let historicoVisual = [];

function limitarHistoricoIA() {

    const maxMensagens = MAX_PARES_MEMORIA * 2;

    if (historicoIA.length > maxMensagens) {

        historicoIA =
            historicoIA.slice(
                historicoIA.length - maxMensagens
            );
    }
}

function renderizarHistorico() {

    if (!historicoVisual.length) {

        historicoLista.innerHTML =
            `<p class="historico-vazio">Nenhuma pergunta ainda.</p>`;

        return;
    }

    historicoLista.innerHTML =
        historicoVisual
            .slice()
            .reverse()
            .map((item, indexReverso) => {

                const indexReal =
                    historicoVisual.length - 1 - indexReverso;

                return `
                    <div class="historico-item" data-index="${indexReal}">
                        <div class="hi-pergunta">🧑 ${item.anexoNome ? `<span class="hi-anexo">📎</span>` : ""}${escaparHtml(item.pergunta)}</div>
                        <div class="hi-resposta">🤖 ${escaparHtml(item.respostaPreview)}</div>
                        <span class="hi-hora">${item.hora}${item.anexoNome ? ` · anexo: ${escaparHtml(item.anexoNome)}` : ""}</span>
                    </div>
                `;
            })
            .join("");

    document
        .querySelectorAll(".historico-item")
        .forEach((el) => {

            el.addEventListener("click", async () => {

                const item =
                    historicoVisual[
                        Number(el.dataset.index)
                    ];

                if (!item) return;

                promptInput.value = item.pergunta;

                resultado.innerHTML =
                    formatarResposta(item.respostaCompleta);

                await renderizarFormulas(resultado);

                atualizarStatus(
                    "Mostrando uma resposta do histórico."
                );
            });
        });
}

function adicionarAoHistorico(pergunta, respostaCompleta, anexoNome) {

    // Memória enviada à IA: guardamos só o TEXTO da pergunta (com uma nota
    // dizendo que havia um anexo) e a resposta. O arquivo em si não fica
    // disponível nas perguntas seguintes — só na pergunta em que foi anexado.
    const textoParaMemoria = anexoNome
        ? `[Arquivo anexado: ${anexoNome}] ${pergunta}`
        : pergunta;

    historicoIA.push({ role: "user", content: textoParaMemoria });
    historicoIA.push({ role: "assistant", content: respostaCompleta });
    limitarHistoricoIA();

    // Memória mostrada na tela
    const preview =
        String(respostaCompleta || "")
            .replace(/[#*_`]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 160);

    const agora = new Date();

    historicoVisual.push({
        pergunta,
        respostaCompleta,
        anexoNome: anexoNome || null,
        respostaPreview: preview || "(sem texto)",
        hora: agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    });

    renderizarHistorico();
}

btnLimparHistorico?.addEventListener(
    "click",
    () => {

        historicoIA = [];
        historicoVisual = [];

        renderizarHistorico();

        atualizarStatus(
            "Histórico apagado. A IA não vai mais lembrar das perguntas anteriores."
        );
    }
);

/* =========================
   COPIAR HISTÓRICO
========================= */
btnCopiarHistorico?.addEventListener(
    "click",
    async () => {
        if (!historicoVisual.length) {
            atualizarStatus(
                "Não há histórico para copiar."
            );
            return;
        }

        const textoHistorico = historicoVisual
            .map((item, index) => {
                return `CONVERSA ${index + 1}

PERGUNTA:
${item.pergunta}

RESPOSTA:
${item.respostaCompleta}

----------------------------------------`;
            })
            .join("\n\n");

        try {
            await navigator.clipboard.writeText(
                textoHistorico
            );

            atualizarStatus(
                "Histórico copiado para a área de transferência."
            );
        } catch (erro) {
            console.error(erro);

            atualizarStatus(
                "Erro ao copiar histórico."
            );
        }
    }
);

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

Você também tem acesso ao histórico das perguntas e respostas anteriores desta conversa.
Use esse histórico quando o usuário perguntar algo que depende do que já foi dito antes
(ex: "e sobre isso?", "continue", "o que eu perguntei antes?").
`;

btnEnviar?.addEventListener(
    "click",
    async () => {

        const pergunta =
            promptInput.value.trim();

        if (!pergunta && !arquivoAnexado) {

            atualizarStatus(
                "Digite uma pergunta ou anexe um arquivo."
            );

            return;
        }

        const anexoDaVez = arquivoAnexado;
        let caminhoTemporario = null;

        try {

            if (
                typeof puter ===
                "undefined"
            ) {

                throw new Error(
                    "Puter não carregado."
                );
            }

            resultado.innerHTML =
                "Processando...";

            // Pergunta usada caso o usuário só anexe o arquivo sem digitar nada.
            const perguntaEfetiva =
                pergunta ||
                (anexoDaVez
                    ? (anexoDaVez.type.startsWith("image/")
                        ? "Descreva o que você vê nesta foto."
                        : "Resuma e explique o conteúdo deste arquivo.")
                    : "");

            // Monta o conteúdo da mensagem do usuário: texto simples, ou
            // (quando há anexo) texto + arquivo, enviado via sistema de
            // arquivos do Puter, que é como a IA consegue "ler" o anexo.
            let conteudoUsuario = perguntaEfetiva;

            if (anexoDaVez) {

                atualizarStatus(
                    "Enviando arquivo..."
                );

                const nomeTemp =
                    `anexo_${Date.now()}_${anexoDaVez.name}`;

                const arquivoSalvo =
                    await puter.fs.write(nomeTemp, anexoDaVez);

                caminhoTemporario = arquivoSalvo.path;

                conteudoUsuario = [
                    { type: "file", puter_path: caminhoTemporario },
                    { type: "text", text: perguntaEfetiva },
                ];
            }

            atualizarStatus(
                "A IA está pensando..."
            );

            // Monta as mensagens enviadas à IA: instruções de formatação
            // (sempre no topo) + todo o histórico já conversado + a pergunta nova.
            // É assim que a memória funciona: o Puter não guarda nada sozinho,
            // então reenviamos a conversa inteira a cada pergunta.
            const mensagens = [
                { role: "system", content: instrucoesFormatacao },
                ...historicoIA,
                { role: "user", content: conteudoUsuario },
            ];

            const resposta = await puter.ai.chat(mensagens);

            const texto =
                resposta?.message?.content ||
                resposta?.content ||
                String(resposta || "");

            	resultado.innerHTML =
    		formatarResposta(texto);

            await renderizarFormulas(resultado);

            adicionarAoHistorico(
                perguntaEfetiva,
                texto,
                anexoDaVez ? anexoDaVez.name : null
            );

            // Limpa o anexo da tela: ele só vale para esta pergunta.
            arquivoAnexado = null;
            fileAnexo.value = "";
            renderizarAnexoPreview();

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

        } finally {

            // Remove o arquivo temporário do armazenamento do Puter,
            // tenha a pergunta dado certo ou não.
            if (caminhoTemporario) {

                try {

                    await puter.fs.delete(caminhoTemporario);

                } catch (erroLimpeza) {

                    console.error(
                        "Não foi possível apagar o arquivo temporário:",
                        erroLimpeza
                    );
                }
            }
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

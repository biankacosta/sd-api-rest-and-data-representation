const API_URL = "http://localhost:5000";

let SearchResponse; 
const coverlessBook =
  "https://img.freepik.com/psd-gratuitas/mockup-de-livro-branco-em-branco-perfeito-para-projetos-de-capa-de-livro-e-projetos-de-publicacao_191095-80351.jpg?semt=ais_hybrid&w=740&q=80";
const resultsDiv = document.getElementById("results");
const textDiv = document.getElementById("text");
const loadingDiv = document.getElementById("loading");

protobuf.load("books.proto", function (err, root) {
  if (err) throw err;

  SearchResponse = root.lookupType("SearchResponse");
});

async function searchBooksProto() {
  const termo = document.getElementById("fieldSearch").value;
  if (!termo) return alert("Digite algo!");

  resultsDiv.innerHTML = ""; 
  loadingDiv.classList.remove("d-none");

  try {
    const response = await fetch(`${API_URL}/search?q=${termo}&format=proto`);

    if (!response.ok) throw new Error("Erro na API");

    const buffer = await response.arrayBuffer();
    console.log(`Recebidos ${buffer.byteLength} bytes de dados.`);

    const decodeMessage = SearchResponse.decode(new Uint8Array(buffer));

    const objeto = SearchResponse.toObject(decodeMessage, {
      longs: String,
      enums: String,
      bytes: String,
    });

    renderBooks(objeto.books || []);
  } catch (error) {
    console.error(error);
    resultsDiv.innerHTML = `<div class="alert alert-danger">Erro: ${error.message}</div>`;
  } finally {
    loadingDiv.classList.add("d-none");
  }
}

function renderBooks(list) {
  if (list.length === 0) {
    resultsDiv.innerHTML =
      '<p class="text-center w-100">Nenhum livro encontrado.</p>';
    return;
  }

  list.forEach((book) => {
    const cover = book.coverUrl || coverlessBook;
    const author = book.author ? book.author.join(", ") : "Desconhecido";

    const safeAuthor = (author || "Desconhecido").replace(/'/g, "\\'");

    const html = `
                    <div class="col">
                        <div class="card h-100 book-card shadow-sm">
                            <img src="${cover}" class="card-img-top cover-book" alt="${book.title}">
                            <div class="card-body">
                                <h5 class="card-title">${book.title}</h5>
                                <p class="card-text text-muted">${author} (${book.year})</p>
                                <button class="btn btn-outline-success btn-sm w-100" 
                                    onclick="addToBookshelf('${book.id}', '${safeAuthor}')">
                                    + Adicionar à Estante
                                </button>
                            </div>
                        </div>
                    </div>
                `;
    resultsDiv.innerHTML += html;
  });
}


async function addToBookshelf(olId, authorName) {
  const status = prompt("Qual o status de leitura?");

  if (!status) return;

  const payload = {
    ol_id: olId,
    status: status,
    author: authorName,
  };

  try {
    const response = await fetch(`${API_URL}/bookshelf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      alert(`Success! ${data.message}`);
    } else {
      alert(`Error: ${data.erro || data.error || "Failed to add book"}`);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("Erro de conexão com o servidor.");
  }
}

async function fetchBookshelf() {
  resultsDiv.innerHTML = "";
  textDiv.innerHTML = "";
  loadingDiv.classList.remove("d-none");

  try {
    const response = await fetch(`${API_URL}/bookshelf`);

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    const bookList = data.books || [];

    renderMyBooks(bookList);
  } catch (error) {
    console.error("Error:", error);
    resultsDiv.innerHTML = `<div class="alert alert-danger w-100">Erro ao carregar estante: ${error.message}</div>`;
  } finally {
    loadingDiv.classList.add("d-none");
  }
}

function renderMyBooks(list) {
  if (list.length === 0) {
    textDiv.innerHTML = `
            <div class="text-center mt-5">
                <h3 class="text-muted">Sua estante está vazia 😢</h3>
                <p>Pesquise livros acima e adicione-os!</p>
            </div>
        `;
    return;
  }

  list.forEach((book) => {
    const cover = book.cover_url || coverlessBook;

    const html = `
            <div class="col">
                <div class="card h-100 book-card shadow-sm border-0">
                    <div class="position-relative">
                        <img src="${cover}" class="card-img-top cover-book" alt="${book.title}">
                    </div>
                    <div class="card-body">
                        <h5 class="card-title text-truncate" title="${book.title}">${book.title}</h5>
                        <p class="card-text text-muted small mb-2">
                            ${book.author}
                        </p>
                        <p class="card-text text-muted small mb-2">
                            Status: ${book.status}
                        </p>
                        
                        <div class="d-flex gap-2 mt-3">
                             <button class="btn btn-outline-primary btn-sm flex-grow-1" 
                                onclick="updateBookStatus('${book.id}')">
                                Editar status
                            </button>
                            <button class="btn btn-outline-danger btn-sm" 
                                onclick="deleteBook('${book.id}')">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    resultsDiv.innerHTML += html;
  });
}


async function updateBookStatus(bookId) {
  const newStatus = prompt("Digite o novo status:");

  if (!newStatus) return;

  const safeId = bookId.replace(/\//g, "__");

  const payload = {
    status: newStatus,
  };

  try {
    const response = await fetch(`${API_URL}/bookshelf/${safeId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      alert(`Success! ${data.message}`);

      fetchBookshelf();
    } else {
      alert(`Error: ${data.erro || "Failed to update book"}`);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("Erro de conexão ao tentar atualizar o livro.");
  }
}

async function deleteBook(bookId) {
  const isConfirmed = confirm(
    "Tem certeza que deseja remover este livro da sua estante?"
  );

  if (!isConfirmed) return;

  const safeId = bookId.replace(/\//g, "__");

  try {
    const response = await fetch(`${API_URL}/bookshelf/${safeId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (response.ok) {
      alert(`Success! ${data.message}`);
      fetchBookshelf();
    } else {
      alert(`Error: ${data.erro || "Failed to delete book"}`);
    }
  } catch (error) {
    console.error("eror:", error);
    alert("Erro de conexão ao tentar deletar o livro.");
  }
}

async function fetchRandomSuggestion() {
  resultsDiv.innerHTML = "";
  textDiv.innerHTML = "";
  loadingDiv.classList.remove("d-none");

  try {
    const response = await fetch(`${API_URL}/suggestion`);

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }

    const suggestion = await response.json();

    renderSuggestion(suggestion);
  } catch (error) {
    console.error("Error:", error);
    resultsDiv.innerHTML = `<div class="alert alert-danger w-100">Erro ao buscar sugestão: ${error.message}</div>`;
  } finally {
    loadingDiv.classList.add("d-none");
  }
}

function renderSuggestion(book) {
  const cover = book.cover_url || coverlessBook;
  const title = book.title || "Título Desconhecido";
  const author = book.author || "Autor Desconhecido";
  const year = book.year || "????";

  const safeTitle = title.replace(/'/g, "\\'");
  const safeAuthor = author.replace(/'/g, "\\'");
  const bookId = book.id || book.key;

  textDiv.innerHTML = `
            <div class="col-12 text-center mb-4">
            <h2 class="text-warning">Temos uma sugestão para você!</h2>
        </div>
        `;

  const html = `
        <div class="col mx-auto" style="max-width: 400px;">
            <div class="card h-100 book-card shadow border-warning">
                <img src="${cover}" class="card-img-top cover-book" alt="${safeTitle}" style="height: 300px;">
                <div class="card-body bg-light">
                    <h4 class="card-title">${title}</h4>
                    <p class="card-text text-muted fs-5">
                        Escrito por <strong>${author}</strong><br>
                        <small>Publicado em ${year}</small>
                    </p>
                    
                    ${
                      bookId
                        ? `
                    <button class="btn btn-success btn-lg w-100 mt-3" 
                        onclick="addToBookshelf('${bookId}', '${safeAuthor}')">
                        + Adicionar Sugestão
                    </button>
                    `
                        : `<div class="alert alert-warning">ID do livro não retornado pelo servidor.</div>`
                    }
                </div>
            </div>
        </div>
    `;

  resultsDiv.innerHTML = html;
}

/**
 * SGV - Gestão de Frota Digital
 * app.js - Lógica Principal Integrada
 */

document.addEventListener('DOMContentLoaded', () => {
    // Configura o formulário de cadastro de veículos
    const addCarForm = document.getElementById('addCarForm');
    if (addCarForm) addCarForm.addEventListener('submit', handleAddCar);

    // Configura o formulário de upload de documentos dentro do modal
    const uploadModalForm = document.getElementById('uploadModalForm');
    if (uploadModalForm) uploadModalForm.addEventListener('submit', handleUploadInsideModal);

    // Atalho: Buscar placa ao pressionar Enter
    const inputPlaca = document.getElementById('inputPlaca');
    if (inputPlaca) {
        inputPlaca.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleCarSearch();
        });
    }
});

// Configuração de notificações curtas (Toasts)
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
});

// --- 1. BUSCA DE VEÍCULO POR PLACA ---
async function handleCarSearch() {
    const placa = document.getElementById('inputPlaca').value.trim().toUpperCase();
    if (placa.length < 3) {
        return Toast.fire({ icon: 'warning', title: 'Digite a placa completa' });
    }

    try {
        const response = await fetch(`/api/carros/pesquisar?placa=${placa}`);
        if (response.ok) {
            const carro = await response.json();
            Toast.fire({ icon: 'success', title: 'Veículo localizado!' });
            expandirCard(carro);
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Não encontrado',
                text: `A placa ${placa} não está cadastrada.`,
                confirmButtonColor: '#1a1a60'
            });
        }
    } catch (e) {
        console.error("Erro na busca:", e);
    }
}

// --- 2. CADASTRO DE NOVO VEÍCULO ---
async function handleAddCar(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    try {
        const response = await fetch('/api/carros', { method: 'POST', body: formData });
        if (response.ok) {
            Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Veículo cadastrado.' });
            event.target.reset();
            bootstrap.Modal.getInstance(document.getElementById('modalAddCar')).hide();
            carregarListaCarros();
        } else {
            const err = await response.json();
            Swal.fire({ icon: 'error', title: 'Erro', text: err.erro || 'Erro ao cadastrar' });
        }
    } catch (e) {
        console.error("Erro:", e);
    }
}

// --- 3. LISTAGEM DA FROTA (ABA FROTA) ---
async function carregarListaCarros() {
    const container = document.getElementById('listaCarrosExistentes');
    if (!container) return;

    container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';

    try {
        const response = await fetch('/api/carros/todos');
        const carros = await response.json();
        container.innerHTML = '';

        if (carros.length === 0) {
            container.innerHTML = '<div class="col-12 text-center text-muted p-5"><p>Nenhum veículo na frota.</p></div>';
            return;
        }

        carros.forEach(carro => {
            const card = `
                <div class="col-md-4">
                    <div class="card-veiculo shadow-sm" onclick='expandirCard(${JSON.stringify(carro).replace(/'/g, "&apos;")})'>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="fw-bold m-0">${carro.marca || ''} ${carro.modelo}</h6>
                            <span class="badge bg-dark" style="font-family: Saira Semi Condensed;">${carro.placa}</span>
                        </div>
                        <div class="small text-muted">${carro.ano || '---'} | ${carro.cor || '---'}</div>
                    </div>
                </div>`;
            container.insertAdjacentHTML('beforeend', card);
        });
    } catch (e) {
        console.error("Erro ao carregar lista:", e);
    }
}

// --- 4. CONFIGURAÇÕES E PERFIL DO USUÁRIO ---
async function carregarPerfil() {
    try {
        const response = await fetch('/api/usuario/perfil');
        const dados = await response.json();

        if (response.ok) {
            document.getElementById('perfilNome').innerText = dados.nome;
            document.getElementById('perfilEmail').innerText = dados.email;
            document.getElementById('perfilLoja').innerText = dados.loja;
            document.getElementById('perfilTotalVeiculos').innerText = dados.total_veiculos;
        }
    } catch (e) {
        console.error("Erro ao carregar perfil:", e);
    }
}

// --- 5. EXPANDIR CARD E DETALHES ---
async function expandirCard(carro) {
    document.getElementById('detalhePlaca').innerText = carro.placa;
    document.getElementById('detalheMarcaModelo').innerText = `${carro.marca || ''} ${carro.modelo}`;
    document.getElementById('detalheAno').innerText = carro.ano || '---';
    document.getElementById('detalheCor').innerText = carro.cor || '---';
    document.getElementById('detalheCarroId').value = carro.id;

    // Limpa rodapé antigo e cria botões de ação
    let modalContent = document.querySelector('#modalDetalhesVeiculo .modal-content');
    let oldFooter = modalContent.querySelector('.modal-footer-acoes');
    if (oldFooter) oldFooter.remove();

    let footer = document.createElement('div');
    footer.className = "modal-footer-acoes d-flex justify-content-between p-3 bg-light border-top";
    footer.style.borderRadius = "0 0 20px 20px";
    footer.innerHTML = `
        <button class="btn btn-sm btn-outline-danger" onclick="confirmarExclusao(${carro.id})"><i class="fas fa-trash me-1"></i>Excluir</button>
        <button class="btn btn-sm btn-warning fw-bold" onclick='abrirEditor(${JSON.stringify(carro).replace(/'/g, "&apos;")})'><i class="fas fa-edit me-1"></i>Editar</button>
    `;
    modalContent.appendChild(footer);

    await atualizarListaAnexosModal(carro.id);
    
    const modalEl = document.getElementById('modalDetalhesVeiculo');
    new bootstrap.Modal(modalEl).show();
}

// --- 6. GESTÃO DE ANEXOS ---
async function atualizarListaAnexosModal(carroId) {
    const container = document.getElementById('detalheListaAnexos');
    container.innerHTML = '<p class="small text-muted">Carregando documentos...</p>';
    
    try {
        const response = await fetch(`/api/carros/${carroId}/documentos`);
        const docs = await response.json();
        container.innerHTML = docs.length === 0 ? '<div class="small text-muted">Nenhum anexo.</div>' : '';
        
        docs.forEach(doc => {
            container.innerHTML += `
                <div class="d-flex justify-content-between align-items-center border-bottom py-1">
                    <span class="small text-truncate" style="max-width: 150px;">${doc.nome_documento}</span>
                    <a href="${doc.caminho_arquivo}" target="_blank" class="btn btn-sm btn-link">Ver</a>
                </div>`;
        });
    } catch (e) { console.error(e); }
}

async function handleUploadInsideModal(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const carroId = document.getElementById('detalheCarroId').value;

    try {
        const response = await fetch('/api/upload_documento', { method: 'POST', body: formData });
        if (response.ok) {
            Toast.fire({ icon: 'success', title: 'Anexo adicionado!' });
            event.target.reset();
            atualizarListaAnexosModal(carroId);
        }
    } catch (e) { console.error(e); }
}

// --- 7. EXCLUIR E EDITAR ---
function confirmarExclusao(id) {
    Swal.fire({
        title: 'Excluir?',
        text: "Isso removerá o carro e todos os documentos!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sim, excluir'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await fetch(`/api/carros/${id}`, { method: 'DELETE' });
            bootstrap.Modal.getInstance(document.getElementById('modalDetalhesVeiculo')).hide();
            carregarListaCarros();
            Swal.fire('Excluído!', '', 'success');
        }
    });
}

async function abrirEditor(carro) {
    const { value: formValues } = await Swal.fire({
        title: 'Editar Veículo',
        html: `
            <input id="swal-marca" class="form-control mb-2" placeholder="Marca" value="${carro.marca || ''}">
            <input id="swal-modelo" class="form-control mb-2" placeholder="Modelo" value="${carro.modelo || ''}">
            <input id="swal-ano" class="form-control mb-2" placeholder="Ano" value="${carro.ano || ''}">
            <input id="swal-cor" class="form-control" placeholder="Cor" value="${carro.cor || ''}">
        `,
        showCancelButton: true,
        confirmButtonText: 'Salvar',
        preConfirm: () => {
            return {
                marca: document.getElementById('swal-marca').value,
                modelo: document.getElementById('swal-modelo').value,
                ano: document.getElementById('swal-ano').value,
                cor: document.getElementById('swal-cor').value
            }
        }
    });

    if (formValues) {
        await fetch(`/api/carros/${carro.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formValues)
        });
        bootstrap.Modal.getInstance(document.getElementById('modalDetalhesVeiculo')).hide();
        carregarListaCarros();
        Toast.fire({ icon: 'success', title: 'Atualizado!' });
    }
}

function confirmarExclusaoConta() {
    Swal.fire({
        icon: 'info',
        title: 'Acesso Restrito',
        text: 'Para excluir sua conta de gestor, entre em contato com o suporte do sistema.',
        confirmButtonColor: '#1a1a60'
    });
}
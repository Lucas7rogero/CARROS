import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, render_template, request, jsonify, url_for, session, redirect
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

app = Flask(__name__)
# Chave de segurança para sessões (Login)
app.secret_key = os.environ.get('SECRET_KEY', 'chave_mestra_sgv_2025')

# Configurações de Upload
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# --- CONEXÃO COM POSTGRESQL (SUPABASE / RENDER) ---
def get_db_connection():
    DATABASE_URL = os.environ.get('DATABASE_URL')
    # O sslmode='require' é obrigatório para o Supabase no Render
    return psycopg2.connect(DATABASE_URL, sslmode='require')

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    # Tabela de Usuários
    cur.execute('''CREATE TABLE IF NOT EXISTS usuarios 
                 (id SERIAL PRIMARY KEY, nome TEXT, nome_loja TEXT, email TEXT UNIQUE, senha TEXT)''')
    
    # Tabela de Carros
    cur.execute('''CREATE TABLE IF NOT EXISTS carros 
                 (id SERIAL PRIMARY KEY, placa TEXT UNIQUE, marca TEXT, modelo TEXT, ano INTEGER, cor TEXT)''')
    
    # Tabela de Documentos
    cur.execute('''CREATE TABLE IF NOT EXISTS documentos 
                 (id SERIAL PRIMARY KEY, carro_id INTEGER REFERENCES carros(id) ON DELETE CASCADE, 
                  nome_documento TEXT, caminho_arquivo TEXT)''')
    conn.commit()
    cur.close()
    conn.close()

# Inicializa o banco ao subir o app
try:
    init_db()
except Exception as e:
    print(f"Erro ao inicializar banco: {e}")

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- ROTAS DE AUTENTICAÇÃO ---

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/api/auth/cadastrar', methods=['POST'])
def cadastrar():
    dados = request.json
    hash_senha = generate_password_hash(dados.get('senha'))
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('INSERT INTO usuarios (nome, nome_loja, email, senha) VALUES (%s, %s, %s, %s)',
                     (dados.get('nome'), dados.get('loja'), dados.get('email'), hash_senha))
        conn.commit()
        return jsonify({"ok": True}), 201
    except:
        return jsonify({"erro": "E-mail já cadastrado"}), 400
    finally:
        cur.close(); conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    dados = request.json
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM usuarios WHERE email = %s', (dados.get('email'),))
    user = cur.fetchone()
    cur.close(); conn.close()
    
    if user and check_password_hash(user['senha'], dados.get('senha')):
        session['user_id'] = user['id']
        session['nome_usuario'] = user['nome']
        session['nome_loja'] = user['nome_loja'] # Corrigido aqui
        return jsonify({"ok": True}), 200
    return jsonify({"erro": "E-mail ou senha inválidos."}), 401

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login_page'))

# --- ROTAS DO SISTEMA ---

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('index.html', nome_loja=session.get('nome_loja', 'SGV FROTA'))

@app.route('/api/carros/todos')
def listar_todos():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM carros ORDER BY id DESC')
    carros = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(carros)

@app.route('/api/carros', methods=['POST'])
def adicionar_carro():
    placa = request.form.get('placa', '').upper()
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('INSERT INTO carros (placa, marca, modelo, ano, cor) VALUES (%s,%s,%s,%s,%s) RETURNING id',
                              (placa, request.form.get('marca'), request.form.get('modelo'), 
                               request.form.get('ano'), request.form.get('cor')))
        carro_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": carro_id}), 201
    except:
        return jsonify({"erro": "Erro ao cadastrar placa"}), 400
    finally:
        cur.close(); conn.close()

@app.route('/api/usuario/perfil')
def perfil_usuario():
    if 'user_id' not in session:
        return jsonify({"erro": "Não autorizado"}), 401
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT nome, email, nome_loja FROM usuarios WHERE id = %s', (session['user_id'],))
    user = cur.fetchone()
    cur.execute('SELECT COUNT(*) FROM carros')
    total = cur.fetchone()['count']
    cur.close(); conn.close()
    return jsonify({**user, "total_veiculos": total})

# --- INICIALIZAÇÃO ---
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
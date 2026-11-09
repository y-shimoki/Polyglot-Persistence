import express from 'express';
import session from 'express-session';
import 'dotenv/config';
import * as MongoDB from './src/mongodb.js';
import * as Postgre from './src/postgre.js';

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

await MongoDB.connectToMongoDB();
await Postgre.connectToPostgreSQL();

let usuario = {
    user: 'oi123',
    senha: 'oi123'
};

// ================= ROTAS GET (PÁGINAS) =================

// Página 1: Login / Cadastro
app.get('/', (req, res) => {
    res.render('login');
});

// Página 2: Home (Catálogo)
app.get('/home', async (req, res) => {
    try {
        
        // ...

        const livros = await MongoDB.getLivros();
    
        const isAdmin = usuario.user.toLowerCase() === 'admin';

        res.render('home', { 
            livros,
            usuario, 
            isAdmin 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar livros.');
    }
});

// Página 3: Perfil do Usuário / Admin
app.get('/user', async (req, res) => {
    try {

        // ...


        // consulta a tabela "Usuario_Livro" no Postgre e retorna os ids dos livros que o usuário possui:
        const idLivros = await Postgre.getLivrosDoUsuario(usuario.user);

        // para cada id encontrado, procura o id no MongoDB e retorna o livro correspondente: 
        const livros = await Promise.all(
            idLivros.map(livro => MongoDB.getLivroPorId(livro.bookId))
        );

        const reviews = await MongoDB.getReviewsDoUsuario(usuario.user);

        // para cada review encontrada (coleção "Reviews"), busca o id do livro correspondente na coleção "Livros" (para pegar o título): 
        const reviewsComTitulo = await Promise.all(
            reviews.map(async (rev) => {
                const livro = await MongoDB.getLivroPorId(rev.bookId); 

                return {
                    ...rev.toObject(),  // mantém os dados originais da review, adicionando o título do livro, se existir;
                    tituloLivro: livro ? livro.titulo : 'Livro não existe mais.'
                };
            })
        );

        const isAdmin = usuario.user.toLowerCase() === 'admin';

        res.render('user', {
            usuario,
            isAdmin,
            reviews: reviewsComTitulo,  // envia a variável 'reviewsComTitulo' com o nome 'reviews' para o ejs;
            livros
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar perfil.');
    }
});

// Página 4: Detalhes do Livro
app.get('/book/:id', async (req, res) => {
    try {
        const bookId = req.params.id;

        const livro = await MongoDB.getLivroPorId(bookId);

        if (!livro) {
            return res.status(404).send('Livro não encontrado.');
        }

        const reviewsDoLivro = await MongoDB.getReviewsDoLivro(bookId);

        const reviewUsuario = await MongoDB.verificarReview(usuario.user, bookId);  // verifica se o usuário ativo já avaliou esse livro;

        res.render('book', {
            livro: livro,
            reviews: reviewsDoLivro,
            reviewUsuario
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar detalhes do livro.');
    }
});

// Ação: Terminar Sessão (Logout)
app.get('/logout', (req, res) => {
    // ...

    res.redirect('/');
});

// ================= ROTAS POST (AÇÕES) =================

// Ação: Entrar (Login)
app.post('/login', async (req, res) => {
    try {
        const { nome, senha } = req.body;

        const usuario = await Postgre.getUsuario(nome);

        if (!usuario || usuario.senha !== senha) {
            return res.send('Usuário ou senha incorretos.');
        }

        res.redirect('/home');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao realizar login.');
    }
});

// Ação: Criar Conta (Register)
app.post('/register', async (req, res) => {
    try {
        const { nome, senha } = req.body;

        const usuarioExistente = await Postgre.getUsuario(nome);  // busca um usuário com o mesmo user no banco;

        if (usuarioExistente) {
            return res.send('Nome de usuário já existe.');  // se encontrar, impede o cadastro;
        }

        await Postgre.cadastrarUsuario(nome, senha);

        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao realizar cadastro');
    }
});

// Ação: Comprar Livro
app.post('/buy/:id', async (req, res) => {
   try {
        // ...

        const bookId = req.params.id;

        const jaPossui = await Postgre.verificarPosse(usuario.user, bookId);

        if (jaPossui) {
            res.send('Você já possui esse livro na conta!')
        } else {
            await Postgre.adicionarLivro(usuario.user, bookId);
            console.log("Operação concluída");
            res.redirect('/user');  // Redireciona para o perfil para ver o livro comprado
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao comprar livro.');
    }
});

// Ação: Enviar Review
app.post('/review/:id', async (req, res) => {
    try {
        // ...

        const bookId = req.params.id;
        const { nota, texto } = req.body;

        const reviewExistente = await MongoDB.verificarReview(usuario.user, bookId);  // checa se o usuário já avaliou esse livro;

        const dadosReview = {
            nota: Number(nota) || 5,
            comentario: texto || ''
        };

        if (reviewExistente) {  // se já avaliou atualiza a review antiga;
            await MongoDB.updateReview(usuario.user, bookId, dadosReview);
        } else {  // se não adiciona uma nova review;
            const novaReview = {
                bookId: bookId,
                user: usuario.user,
                ...dadosReview
            };
            await MongoDB.addReview(novaReview);
        }

        res.redirect(`/book/${bookId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao enviar review.');
    }
});

// Ação Admin: Adicionar Novo Livro
app.post('/admin/add-book', async (req, res) => {
    try {
        const { titulo, sinopse, genero, autor, preco, capa } = req.body;

        await MongoDB.adicionarLivro({
            titulo,
            sinopse,
            genero,
            autor,
            preco,
            capa
        });

        res.redirect('/home');

    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao cadastrar livro');
    }
});

// Iniciar Servidor na Porta 3000
app.listen(3000, () => {
    console.log('Server executando em http://localhost:3000');
});

import mongoose from 'mongoose';

export async function connectToMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "Polyglot-Persistence"
    });
    console.log("MongoDB Conectado!");
    return mongoose;
  } catch (err) {
    console.dir(err);
    throw err;
  }
}

const LivroSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true
  },
  autor: {
    type: String,
    required: true
  },
  genero: {
    type: [String],
    required: true
  },
  sinopse: {
    type: String,
    required: true
  },
  capa: {
    type: String
  }
});

const ReviewSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }, 
  user: {
    type: String,
    required: true
  },
  nota: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comentario: {
    type: String
  }
});

const Livro = mongoose.model("Livro", LivroSchema, "Livros");
const Review = mongoose.model("Review", ReviewSchema, "Reviews");

// CREATE //
// cadastrar livro (para adm): 
export async function addLivro(dadosLivro) {
  const novoLivro = new Livro(dadosLivro);
  return await novoLivro.save();
}

// adicionar review: 
export async function addReview(dadosReview) {
  const novaReview = new Review(dadosReview);
  return await novaReview.save();
}

// READ //
// buscar todos os livros:
export async function getLivros(){
  return await Livro.find();
}

// buscar um livro específico por id (para a página de detalhes do livro):
export async function getLivroPorId(id) {
  return await Livro.findById(id);
}

// pesquisar livro por título:
export async function pesquisarPorTitulo(tituloCaixaDeTexto) {
  return await Livro.find({
    titulo: { 
      $regex: tituloCaixaDeTexto, 
      $options: 'i'  // 'i' faz ser case insensitive;
    }
  });
}

// pesquisar livro por autor:
export async function pesquisarPorAutor(autorCaixaDeTexto) {
  return await Livro.find({
    autor: { 
      $regex: autorCaixaDeTexto, 
      $options: 'i' }
  });
}

// buscar todos os livros de um gênero específico (para os botões de gênero no topo da página de busca):
export async function getLivrosPorGenero(genero) {
  return await Livro.find({ genero: genero });
}

// buscar todas as reviews de um livro:
export async function getReviewsDoLivro(bookId) {
  return await Review.find({ bookId: bookId });
}

// buscar todas as reviews de um usuário:
export async function getReviewsDoUsuario(user) {
  return await Review.find({ user: user });
}

// verifica se um usuário já avaliou um livro:
export async function verificarReview(user, bookId) {
    return await Review.findOne({
        user: user,
        bookId: bookId
    });
}

// UPDATE //
// atualizar livro (para adm): 
export async function updateLivro(id, dadosLivro) {
    return await Livro.findByIdAndUpdate(
        id,
        dadosLivro,
        { returnDocument: 'after', runValidators: true }
    );
}

// atualizar review:
export async function updateReview(user, bookId, dadosReview) {
    return await Review.findOneAndUpdate(
        { 
          user: user, 
          bookId: bookId 
        },
        {
            nota: dadosReview.nota,
            comentario: dadosReview.comentario
        },
        { returnDocument: 'after' }
    );
}

// DELETE //
// apagar livro (para adm):
export async function deleteLivro(id) {
    return await Livro.findByIdAndDelete(id);
}

// apagar review:
export async function deleteReview(reviewId, user) {
    return await Review.findOneAndDelete({
        _id: reviewId,
        user: user
    });
}

// apagar todas as reviews de um usuário (caso excluir a conta):
export async function deleteReviewsByUser(user) {
    return await Review.deleteMany({ user: user });
}

/*
export async function disconnectFromMongoDB() {
  await mongoose.connection.close();
}
*/
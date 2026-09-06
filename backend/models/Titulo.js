const mongoose = require("mongoose");

const tituloSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },
    titulo: { type: String, required: true },
    tipo:   { type: String, required: true },
    nota:   {
        type: Number,
        required: true,
        min: [0, "A nota não pode ser negativa."],
        max: [10, "A nota não pode ser maior que 10."]
    },
    status: {
        type: String,
        enum: ["Assistido", "Quero Assistir"],
        default: "Quero Assistir"
    },
    poster: {
        type: String,
        default: null
    },
    ano: {
        type: String,
        default: null
    },
    favorito: {
        type: Boolean,
        default: false
    },
    descricao: {
        type: String,
        default: null
    },
    genero: {
        type: String,
        default: null
    },
    diretor: {
        type: String,
        default: null
    },
    comentario: {
        type: String,
        default: null
    },
    // Código curto e aleatório usado na URL da página de detalhes, em vez
    // do id real do banco de dados — assim a URL não mostra esse
    // identificador interno. "sparse" deixa títulos antigos sem esse campo
    // até a primeira vez que forem acessados, sem dar conflito.
    codigoUrl: {
        type: String,
        unique: true,
        sparse: true
    }
});

module.exports = mongoose.model("Titulo", tituloSchema);

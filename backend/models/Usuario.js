const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema(
    {
        nome: {
            type: String,
            required: [true, "O nome é obrigatório."],
            trim: true
        },
        email: {
            type: String,
            required: [true, "O e-mail é obrigatório."],
            unique: true,
            lowercase: true,
            trim: true
        },
        senhaHash: {
            type: String,
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Usuario", usuarioSchema);

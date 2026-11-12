import os
import json
import re
import difflib

import numpy as np
from dotenv import load_dotenv
from groq import Groq
from rank_bm25 import BM25Okapi


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Model terbaru yang digunakan pada Groq
# Pengganti llama-3.1-8b-instant
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

if not GROQ_API_KEY:
    raise RuntimeError(
        "GROQ_API_KEY tidak ditemukan. "
        "Pastikan API key tersedia di file .env."
    )

client = Groq(api_key=GROQ_API_KEY)


# ============================================================
# LOAD DATASET
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "dataset_pmb.json")

with open(DATASET_PATH, "r", encoding="utf-8") as file:
    dataset = json.load(file)


# ============================================================
# SYNONYM DICTIONARY
# ============================================================

SYNONYMS = {
    "daftar": ["registrasi", "pendaftaran"],
    "registrasi": ["daftar", "pendaftaran"],
    "pendaftaran": ["daftar", "registrasi"],

    "biaya": ["harga", "uang", "bayaran"],
    "harga": ["biaya", "uang", "bayaran"],
    "uang": ["biaya", "harga"],

    "kuliah": ["perkuliahan"],
    "kampus": ["universitas", "ug"],
    "universitas": ["kampus", "ug"],
    "jurusan": ["prodi", "program studi"],
    "prodi": ["jurusan", "program studi"],

    "beasiswa": ["bantuan pendidikan"],
    "bayar": ["pembayaran"],
    "pembayaran": ["bayar"],

    "masuk": ["seleksi"],
    "seleksi": ["masuk"],

    "lokasi": ["alamat", "tempat"],
    "alamat": ["lokasi", "tempat"],

    "jadwal": ["waktu"],
    "waktu": ["jadwal"],

    "formulir": ["form"],
    "form": ["formulir"],

    "mahasiswa": ["maba", "calon mahasiswa"],
    "maba": ["mahasiswa", "calon mahasiswa"],
}


# ============================================================
# PREPROCESSING
# ============================================================

def normalize_text(text):
    """
    Normalisasi teks:
    - lowercase
    - menghapus karakter khusus
    - mempertahankan karakter Unicode
    """

    text = str(text).lower()

    # Mengganti karakter selain huruf, angka, dan spasi
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)

    # Menghapus spasi berlebih
    text = re.sub(r"\s+", " ", text).strip()

    return text


# ============================================================
# BUILD VOCABULARY UNTUK TYPO CORRECTION
# ============================================================

all_text = []

for item in dataset:
    question = item.get("question", "")
    answer = item.get("answer", "")

    all_text.append(normalize_text(question))
    all_text.append(normalize_text(answer))

VOCABULARY = set()

for text in all_text:
    VOCABULARY.update(text.split())


# ============================================================
# TYPO CORRECTION
# ============================================================

def correct_typo(token):
    """
    Mengoreksi typo sederhana menggunakan difflib.
    Koreksi hanya dilakukan apabila kemiripan >= 80%.
    """

    if len(token) <= 2:
        return token

    # Jika kata sudah ada di vocabulary
    if token in VOCABULARY:
        return token

    matches = difflib.get_close_matches(
        token,
        VOCABULARY,
        n=1,
        cutoff=0.8
    )

    if matches:
        return matches[0]

    return token


# ============================================================
# PREPROCESS FUNCTION
# ============================================================

def preprocess(text):
    """
    Pipeline preprocessing:
    1. Normalisasi
    2. Tokenisasi
    3. Koreksi typo
    4. Ekspansi sinonim
    """

    text = normalize_text(text)

    tokens = text.split()

    corrected_tokens = []

    for token in tokens:
        corrected = correct_typo(token)
        corrected_tokens.append(corrected)

    expanded_tokens = list(corrected_tokens)

    for token in corrected_tokens:
        if token in SYNONYMS:
            expanded_tokens.extend(SYNONYMS[token])

    return expanded_tokens


# ============================================================
# BUILD BM25 INDEX
# ============================================================

tokenized_questions = []

for item in dataset:
    question = item.get("question", "")
    tokenized_questions.append(preprocess(question))

bm25 = BM25Okapi(tokenized_questions)


# ============================================================
# RETRIEVAL
# ============================================================

def retrieve(user_query, top_k=3, threshold=0.5):
    """
    Mengambil dokumen paling relevan menggunakan BM25.
    """

    query_tokens = preprocess(user_query)

    if not query_tokens:
        return []

    scores = bm25.get_scores(query_tokens)

    top_indices = np.argsort(scores)[::-1][:top_k]

    results = []

    for index in top_indices:
        score = float(scores[index])

        if score >= threshold:
            results.append({
                "question": dataset[index]["question"],
                "answer": dataset[index]["answer"],
                "score": score
            })

    return results


# ============================================================
# BUILD CONTEXT
# ============================================================

def build_context(results):
    """
    Membentuk context dari hasil retrieval BM25.
    """

    if not results:
        return "Tidak ada informasi yang relevan ditemukan dalam dataset."

    context_parts = []

    for i, result in enumerate(results, start=1):
        context_parts.append(
            f"""
Informasi {i}:
Pertanyaan: {result['question']}
Jawaban: {result['answer']}
"""
        )

    return "\n".join(context_parts)


# ============================================================
# STREAM RESPONSE
# ============================================================

def stream_response(user_input, chat_history=None):
    """
    Menghasilkan respons chatbot secara streaming.
    """

    if chat_history is None:
        chat_history = []

    try:

        # ----------------------------------------------------
        # RETRIEVAL
        # ----------------------------------------------------

        results = retrieve(
            user_input,
            top_k=3,
            threshold=0.5
        )

        context = build_context(results)

        # ----------------------------------------------------
        # SYSTEM PROMPT
        # ----------------------------------------------------

        system_prompt = f"""
Kamu adalah chatbot layanan informasi Penerimaan Mahasiswa Baru
(PMB) Universitas Gunadarma.

Tugas utama kamu adalah membantu calon mahasiswa memperoleh
informasi mengenai PMB Universitas Gunadarma.

Gunakan informasi yang tersedia pada CONTEXT sebagai sumber utama.

ATURAN:
1. Jawab menggunakan bahasa Indonesia yang jelas dan natural.
2. Jangan membuat informasi baru yang tidak terdapat dalam context.
3. Jika informasi tidak tersedia dalam context, katakan bahwa
   informasi tersebut belum tersedia dalam basis pengetahuan.
4. Jangan mengarang biaya, jadwal, alamat, program studi,
   beasiswa, atau informasi PMB lainnya.
5. Jika pertanyaan membutuhkan informasi yang tidak tersedia,
   sarankan pengguna menghubungi pihak PMB atau mengakses
   website resmi Universitas Gunadarma.
6. Jawaban harus langsung menjawab pertanyaan pengguna.
7. Jangan menyebutkan proses BM25, RAG, context, dataset,
   atau teknologi internal kepada pengguna.

CONTEXT:
{context}
"""

        messages = [
            {
                "role": "system",
                "content": system_prompt
            }
        ]

        # ----------------------------------------------------
        # CONVERSATION HISTORY
        # ----------------------------------------------------

        if isinstance(chat_history, list):

            # Maksimal 6 pesan terakhir
            recent_history = chat_history[-6:]

            for message in recent_history:

                if not isinstance(message, dict):
                    continue

                role = message.get("role")
                content = message.get("content")

                if role not in ["user", "assistant"]:
                    continue

                if not content:
                    continue

                messages.append({
                    "role": role,
                    "content": str(content)
                })

        # ----------------------------------------------------
        # CURRENT QUESTION
        # ----------------------------------------------------

        messages.append({
            "role": "user",
            "content": user_input
        })

        # ----------------------------------------------------
        # GROQ API
        # ----------------------------------------------------

        stream = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=512,
            stream=True
        )

        # ----------------------------------------------------
        # STREAM TOKEN
        # ----------------------------------------------------

        for chunk in stream:

            try:
                content = chunk.choices[0].delta.content

                if content:
                    yield content

            except (AttributeError, IndexError, TypeError):
                continue

    except Exception as e:

        print("=" * 60)
        print("ERROR PADA GROQ / STREAM RESPONSE")
        print(str(e))
        print("=" * 60)

        # Jangan membuat bubble chatbot kosong.
        yield (
            "\n\nMaaf, terjadi kendala saat menghubungkan "
            "ke layanan chatbot. Silakan coba beberapa saat lagi."
        )
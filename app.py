from flask import Flask, render_template, request, Response, stream_with_context

from chatbot_engine import stream_response


app = Flask(__name__)


# ============================================================
# HOME
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")


# ============================================================
# CHAT
# ============================================================

@app.route("/chat", methods=["POST"])
def chat():

    try:

        data = request.get_json(silent=True) or {}

        user_message = data.get("message", "")
        chat_history = data.get("history", [])

        if not user_message.strip():
            return Response(
                "Pertanyaan tidak boleh kosong.",
                mimetype="text/plain"
            )

        @stream_with_context
        def generate():

            for response_chunk in stream_response(
                user_message,
                chat_history
            ):
                yield response_chunk

        return Response(
            generate(),
            mimetype="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no"
            }
        )

    except Exception as e:

        print("ERROR /chat:", e)

        return Response(
            "Maaf, terjadi kesalahan pada server.",
            status=500,
            mimetype="text/plain"
        )


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
from flask import Flask, request, Response, jsonify
from flask_cors import CORS
import requests
import random
import dicttoxml
import books_pb2

app = Flask(__name__)
CORS(app)

bookshelf = {}


@app.route('/search', methods=['GET'])
def search():
    term = request.args.get('q')
    fmt = request.args.get('format', 'json')

    base_url = "https://openlibrary.org/search.json"

    params = {
        'q': term,
        'fields': 'title,author_name,first_publish_year,key,cover_i',
        'limit': 100
    }

    resp = requests.get(base_url, params=params)
    data = resp.json()

    if fmt == 'proto':
        response_proto = books_pb2.SearchResponse()

        for doc in data.get('docs', []):
            book = response_proto.books.add()
            book.title = str(doc.get('title', 'Sem Título'))
            book.id = str(doc.get('key', ''))
            year = doc.get('first_publish_year')
            book.year = int(year) if isinstance(year, int) else 0
            author = doc.get('author_name', [])
            if author:
                book.author.extend([str(a) for a in author])

            cover_i = doc.get('cover_i')
            if cover_i:
                book.cover_url = f"https://covers.openlibrary.org/b/id/{cover_i}-S.jpg"

        return Response(response_proto.SerializeToString(), mimetype='application/x-protobuf')

    return jsonify(data.get('docs', []))


@app.route('/bookshelf', methods=['POST'])
def add_book():
    fmt = request.args.get('format', 'json')

    data = request.json
    ol_key = data.get('ol_id')
    status = data.get('status')
    author_name = data.get('author')

    if not ol_key or not status:
        msg = {"erro": "ID do livro e status são obrigatórios"}
        if fmt == 'xml':
            return Response(dicttoxml.dicttoxml(msg, custom_root='erro', attr_type=False), mimetype='application/xml',
                            status=400)
        return jsonify(msg), 400

    for book in bookshelf.values():
        if book.get('id') == ol_key:
            msg = {"erro": "Este livro já está na sua biblioteca"}
            if fmt == 'xml':
                return Response(dicttoxml.dicttoxml(msg, custom_root='erro', attr_type=False),
                                mimetype='application/xml', status=409)
            return jsonify(msg), 409

    url_extern = f"https://openlibrary.org{ol_key}.json"

    resp = requests.get(url_extern)

    if resp.status_code == 404:
        msg = {"erro": "Livro não encontrado"}
        if fmt == 'xml':
            return Response(dicttoxml.dicttoxml(msg, custom_root='erro', attr_type=False), mimetype='application/xml',
                            status=404)
        return jsonify(msg), 404

    book_data = resp.json()

    title_api = book_data.get('title')
    if isinstance(title_api, dict):
        title_api = title_api.get('value')

    cover_id = None
    if 'covers' in book_data and book_data['covers']:
        cover_id = book_data['covers'][0]

    new_book = {
        "id": ol_key,
        "title": title_api,
        "author": author_name or "Desconhecido",
        "status": status,
        "cover_url": f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg" if cover_id else "",
    }

    bookshelf[ol_key] = new_book

    response_data = {
        "message": "Livro adicionado com sucesso!",
        "book": new_book
    }

    if fmt == 'xml':
        xml_data = dicttoxml.dicttoxml(response_data, custom_root='response', attr_type=False)
        return Response(xml_data, mimetype='application/xml', status=201)

    return jsonify(response_data), 201


@app.route('/bookshelf', methods=['GET'])
def list_bookshelf():
    fmt = request.args.get('format', 'json')

    list_books = list(bookshelf.values())

    response_data = {
        "total": len(list_books),
        "books": list_books
    }

    if fmt == 'xml':
        xml_data = dicttoxml.dicttoxml(response_data, custom_root='bookshelf', attr_type=False)
        return Response(xml_data, mimetype='application/xml', status=200)

    return jsonify(response_data), 200


@app.route('/bookshelf/<id_book>', methods=['PUT'])
def update_book(id_book):
    real_id = id_book.replace('__', '/')

    if real_id not in bookshelf:
        return jsonify({"erro": "Livro não encontrado na sua biblioteca"}), 404

    data = request.json
    book = bookshelf[real_id]

    new_status = data.get('status')

    book['status'] = new_status

    return jsonify({
        "message": "Livro atualizado com sucesso!",
        "book": book
    }), 200


@app.route('/bookshelf/<id_book>', methods=['DELETE'])
def delete_book(id_book):
    fmt = request.args.get('format', 'json')

    real_id = id_book.replace('__', '/')

    if real_id not in bookshelf:
        message_error = {"erro": "Livro não encontrado na biblioteca."}

        if fmt == 'xml':
            xml_error = dicttoxml.dicttoxml(message_error, custom_root='erro', attr_type=False)
            return Response(xml_error, mimetype='application/xml', status=404)

        return jsonify(message_error), 404

    removed_data = bookshelf[real_id]
    del bookshelf[real_id]

    message_success = {
        "message": "Livro removido com sucesso",
        "deleted_book": {
            "title": removed_data.get('title'),
            "id": real_id
        }
    }

    if fmt == 'xml':
        xml_sucesso = dicttoxml.dicttoxml(message_success, custom_root='sucesso', attr_type=False)
        return Response(xml_sucesso, mimetype='application/xml', status=200)

    return jsonify(message_success), 200


@app.route('/suggestion', methods=['GET'])
def suggest_random_book():
    fmt = request.args.get('format', 'json')

    genres = [
        "fantasy", "science_fiction", "mystery", "horror",
        "romance", "history", "biography", "thriller",
        "business", "programming"
    ]

    drawn_genres = random.choice(genres)
    url = "https://openlibrary.org/search.json"
    params = {
        "q": f"subject:{drawn_genres}",
        "sort": "random",
        "limit": 1,
        "fields": "title,author_name,first_publish_year,cover_i,key"
    }

    try:
        extern_response = requests.get(url, params=params, timeout=5)

        if extern_response.status_code != 200:
            return jsonify({"erro": "Falha na comunicação com a API"}), 502

        data = extern_response.json()

    except Exception as e:
        return jsonify({"erro": "Erro interno ao buscar sugestão"}), 500

    if data.get('numFound', 0) > 0:
        book_raw = data['docs'][0]
        suggestion = {
            "title": book_raw.get('title'),
            "author": book_raw.get('author_name', ['Autor Desconhecido'])[0],
            "year": book_raw.get('first_publish_year', 'N/A'),
            "id": book_raw.get('key')
        }
        if 'cover_i' in book_raw:
            suggestion["cover_url"] = f"https://covers.openlibrary.org/b/id/{book_raw['cover_i']}-M.jpg"
        else:
            suggestion["cover_url"] = ""

        if fmt == 'xml':
            xml_data = dicttoxml.dicttoxml(suggestion, custom_root='sugestao', attr_type=False)
            return Response(xml_data, mimetype='application/xml')

        return jsonify(suggestion), 200

    else:
        return jsonify({"erro": "Nenhum livro encontrado neste sorteio. Tente novamente."}), 404


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)


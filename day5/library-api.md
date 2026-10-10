# Library Books API

Base path: `/api/books`

## Endpoints

- **GET `/api/books`** - List all books. Success: `200 OK`.
- **GET `/api/books/{bookId}`** - Get one book by ID. Success: `200 OK`.
- **POST `/api/books`** - Create a book. Example request body:
  ```json
  {
    "title": "The Left Hand of Darkness",
    "author": "Ursula K. Le Guin",
    "publishedYear": 1969
  }
  ```
  Success: `201 Created`.
- **PUT `/api/books/{bookId}`** - Replace the details of a book. Example request body:
  ```json
  {
    "title": "The Left Hand of Darkness",
    "author": "Ursula K. Le Guin",
    "publishedYear": 1969
  }
  ```
  Success: `200 OK`.
- **DELETE `/api/books/{bookId}`** - Delete a book. Success: `204 No Content`.
- **GET `/api/books?author={authorName}`** - List books by author; for example, `/api/books?author=Ursula%20K.%20Le%20Guin`. Success: `200 OK`.

## Errors

- **`400 Bad Request`** - The request contains invalid data, such as a create request with a missing title.
- **`404 Not Found`** - The requested book ID does not exist.
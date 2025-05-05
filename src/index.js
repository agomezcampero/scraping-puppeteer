const express = require('express');
const path = require('path');
const bookService = require('./services/bookService');
const falabellaService = require('./services/falabellaService');
const app = express();
const port = process.env.PORT || 8080;

// Set up middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/search', async (req, res) => {
    try {
        const { query, page = 1 } = req.query;
        if (!query) {
            return res.render('index', { error: 'Please enter a search query' });
        }

        const books = await bookService.searchBooks(query, parseInt(page));
        res.render('results', { 
            books,
            query,
            currentPage: parseInt(page),
            error: null
        });
    } catch (error) {
        console.error('Search error:', error);
        res.render('results', { 
            books: [],
            query: req.query.query,
            currentPage: 1,
            error: 'Failed to search books. Please try again.'
        });
    }
});

app.get('/book/:url(*)', async (req, res) => {
    try {
        const bookUrl = req.params.url;
        const { query, page } = req.query;
        
        if (!bookUrl.startsWith('https://www.gutenberg.org')) {
            return res.status(400).render('error', { 
                error: 'Invalid book URL' 
            });
        }

        const bookDetails = await bookService.getBookDetails(bookUrl);
        res.render('book', { 
            book: bookDetails, 
            error: null,
            searchQuery: query,
            searchPage: page
        });
    } catch (error) {
        console.error('Book details error:', error);
        res.render('book', { 
            book: null, 
            error: 'Failed to fetch book details. Please try again.',
            searchQuery: req.query.query,
            searchPage: req.query.page
        });
    }
});

// Falabella authentication endpoint
app.post('/api/falabella/mabaya_code', async (req, res) => {
    if (!req.body) {
        return res.status(400).json({ error: 'Request body is required' });
    }

    const { email, password } = req.body;
    
    try {
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const mabayaCode = await falabellaService.mabayaCode(email, password);
        res.json({ mabayaCode });
    } catch (error) {
        console.error('Falabella auth error:', error);
        res.status(500).json({ error: 'Failed to generate authentication URL' });
    }
});

// Add global error handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// Cleanup on shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing browser...');
    await bookService.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Closing browser...');
    await bookService.close();
    process.exit(0);
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server starting on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
}); 
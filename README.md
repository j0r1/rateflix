Some tools to add IMDB/Rotten Tomatoes/TMDB/Movielens ratings to movies/series on Netflix

First step is to start the helper program:

 - install dependencies with 

       npm install 

 - to enable the [movielens](https://movielens.org/) info, you need to create
   a file called ``movielensaccount.json``, with contents

       {"userName": "your.login@someaddress.com", "password": "yourmovielenspassword"}

 - start server on a certain port, with a number of worker threads, e.g.

       node lookupserver.js 9000 4

Install the bookmarklet by surfing to http://localhost:9000 and dragging the
link to the bookmarks bar.

When the Netflix page is open, start the bookmarklet to do the lookups for the
movies that are shown.

Notes:

 - clicking on the ratings opens the pages from which the ratings were
   extracted
 - information is cached (at the moment indefinitely) in localStorage

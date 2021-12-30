
class MovieRatings
{
    constructor(name)
    {
        this.name = name;
        this.visible = true;
        this.ratingInfo = null;
        this.ratingsRequested = false;
    }

    getName()
    {
        return this.name;
    }

    setVisible(v)
    {
        this.visible = v;
    }

    getRatingInfo()
    {
        return this.ratingInfo;
    }

    setRatingInfo(r)
    {
        this.ratingInfo = r;
    }

    getRatingsRequested()
    {
        return this.ratingsRequested;
    }

    setRatingsRequested(r)
    {
        this.ratingsRequested = r;
    }
}

let ws = null;
let queuedCommands = [ ];

function sendQueuedCommands()
{
    if (!ws)
        return;

    if (ws.readyState !== WebSocket.OPEN)
        return;

    for (let q of queuedCommands)
    {
        let s = JSON.stringify(q);
        ws.send(s);
        console.log("Sending queued " + s);
    }

    queuedCommands = [];
}

function sendCommand(cmd, name)
{
    // If it's a cancel, see if we can prevent it from even being sent out
    if (cmd === "cancel")
    {
        let newQueuedCommands = [];
        let found = false;
        for (let i = 0 ; i < queuedCommands.length ; i++)
        {
            if (queuedCommands[i]["name"] !== name)
                newQueuedCommands.push(queuedCommands[i]);
            else
                found = true;
        }

        queuedCommands = newQueuedCommands;

        if (!found) // Didn't remove anything from the queue, add it
            queuedCommands.push({"command": "cancel", "name": name});
    }
    else
    {
        queuedCommands.push({"command": cmd, "name": name});
    }
    console.log("Command list:");
    console.log(queuedCommands);

    sendQueuedCommands();
}

function cancelRatingRequests(movies)
{
    for (let m of movies)
    {
        sendCommand("cancel", m.getName());
        m.setRatingsRequested(false);
    }
}

function startRatingRequestIfNeeded(movies)
{
    for (let m of movies)
    {
        if (m.getRatingInfo() !== null) // Already have ratings
            continue;

        if (m.getRatingsRequested()) // Already signalled rating request
            continue;

        sendCommand("lookup", m.getName());
        m.setRatingsRequested(true);
    }
}

// https://stackoverflow.com/a/5354536/2828217
function checkVisible(elm)
{
    let rect = elm.getBoundingClientRect();
    let viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
    return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
}

let allMovies = { }
let visibleMovies = []

function showRatings(boxart, m)
{
    if (!boxart.ratingDiv)
    {
        let ratingDiv = document.createElement("div");
        ratingDiv.style.position = "relative";
        ratingDiv.style.backgroundColor = "#000000a0";
        ratingDiv.style.top = "0px";
        boxart.ratingDiv = ratingDiv;
        boxart.appendChild(ratingDiv);
    }
    
    let ratings = m.getRatingInfo();
    if (!ratings)
        boxart.ratingDiv.innerHTML = "Loading...";
    else
    {
        let html = "";
        for (let rater in ratings)
            html += rater + ": " + ratings[rater] + "<br>";
        boxart.ratingDiv.innerHTML = html;
    }
}

function processResult(msg)
{
    console.log("Got result");
    let r = JSON.parse(msg);
    console.log(r);
    if (r.name in allMovies)
        allMovies[r.name].setRatingInfo(r.results);
}

function visibleMoviesCheck()
{
    if (ws === null)
    {
        ws = new WebSocket("ws://localhost:8000");
        ws.onmessage = (msg) => { processResult(msg.data); };
        ws.onopen = sendQueuedCommands;
        ws.onclose = () => { ws = null; }
    }

    let noLongerVisible = new Map();
    // Clear list of visible movies
    for (let m of visibleMovies)
    {
        m.setVisible(false);
        noLongerVisible.set(m, true);
    }
    visibleMovies = []

    // Build new list of visible movies
    let images = document.querySelectorAll("img.boxart-image");
    for (let i of images)
    {
        let boxart = i.parentElement;
        let anchor = boxart.parentElement;
        let name = anchor.getAttribute("aria-label");
        let hidden = anchor.getAttribute("aria-hidden");
        if (hidden === "false")
        {
            if (checkVisible(i))
            {
                let m = null;
                if (name in allMovies)
                    m = allMovies[name];
                else
                {
                    m = new MovieRatings(name);
                    allMovies[name] = m;
                }
                m.setVisible(true);

                visibleMovies.push(m);
                if (noLongerVisible.has(m))
                    noLongerVisible.delete(m);

                showRatings(boxart, m);
            }
        }
    }

    cancelRatingRequests(noLongerVisible.keys());
    startRatingRequestIfNeeded(visibleMovies);

    /*
    // Debug: list visible movies
    let s = "";
    for (let m of visibleMovies)
        s += m.getName() + ":";
    console.log("Visible:" + s);

    // List no longer visible:
    s = "";
    for (let m of noLongerVisible.keys())
        s += m.getName() + ":";
    if (s.length > 0)
        console.log("No longer visible:" + s);
    */
}

function main()
{
    console.log("main(module)");
    if (window.rateFlixTimer !== undefined)
    {
        clearInterval(window.rateFlixTimer);
        console.log("Cleared old timer");
    }

    window.rateFlixTimer = setInterval(visibleMoviesCheck, 1000);
}

console.log("Main module");
main();

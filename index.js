const cors = require('cors');
var app = require('express')();
var http = require('http').createServer(app);
const PORT = 8080;
var io = require('socket.io')(http, {cors: {origin: '*'}});

app.use(cors());

var CHANNELS = [];

http.listen(PORT, () => {
    console.log(`listening on port:${PORT}`);
});

io.on('connection', (socket) => {
    socket.emit('connection', null);
    console.log("new client connected");
    //if user is alone create new channel
    //if another user is waiting join the user
    socket.on('join', id => {
        CHANNELS.forEach(id => {
            console.log(id);
        });
        console.log(id);
        if(CHANNELS.length <= 0) {
            CHANNELS.push({sockets: [socket.id], choices: [null,null], results: [], reset:[]});
            console.log("first");
        } else if (CHANNELS.length > 0) {
            CHANNELS[0].sockets.push(socket.id);
            console.log("second");
            io.emit('oponent');
        }
    });

    socket.on('choice', (id, choice) => {
        let index = CHANNELS[0].sockets.indexOf(id);
        CHANNELS[0].choices.splice(index,1,choice);
        console.log(CHANNELS[0]);
        if(CHANNELS[0].choices[0] != null && CHANNELS[0].choices[1] != null)
        {
            winner(CHANNELS[0].choices[0], CHANNELS[0].choices[1]);

            io.to(CHANNELS[0].sockets[0]).emit('oponent-choice', CHANNELS[0].choices[1], CHANNELS[0].results[0]);
            io.to(CHANNELS[0].sockets[1]).emit('oponent-choice', CHANNELS[0].choices[0], CHANNELS[0].results[1]);
        }
    });

    socket.on('reset', (id) => {
        CHANNELS[0].choices = [null, null];
        CHANNELS[0].results = [];
        if(CHANNELS[0].reset.indexOf(id) == -1) {
            CHANNELS[0].reset.push(id);
            if(CHANNELS[0].reset.length > 1) {
                io.emit('reset');
                CHANNELS[0].reset=[];
            }
        }
    });

    socket.on('disconnect', () => {
        if(CHANNELS[0] != null)
        {
            if(CHANNELS[0].sockets.indexOf(socket.id) != -1)
            {
                let index = CHANNELS.indexOf(socket.id);
                CHANNELS.splice(index,1);
                console.log("disconnect");
            } 
        }
    });

    let winner = ((p1,p2) => {
        if((p1+1)%3 == p2){
            //p2 won
            CHANNELS[0].results.push(0);
            CHANNELS[0].results.push(1);
        } else if(p1 == p2){
            //draw
            CHANNELS[0].results.push(2);
            CHANNELS[0].results.push(2);
        } else {
            //p1 won
            CHANNELS[0].results.push(1);
            CHANNELS[0].results.push(0);
        }
    });

});
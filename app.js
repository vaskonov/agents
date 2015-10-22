// This is a manager for negotiation agents.
//outher: Osnat Drein
// It creates agents that connect, as socket.io clients, to our negotiation server. 
var net = require('net');

var HOST = '127.0.0.1';
var AGENT_PORT = (process.argv[2]);
var agent;
var server = net.createServer();
server.listen(AGENT_PORT, HOST);

console.log('Server listening To Agent Manager ' + HOST +':'+ AGENT_PORT);
server.on('connection', function(sock) {
    console.log("New agent manager connected");
    
    // Add a 'close' event handler to this instance of socket
    sock.on('close', function(data) {
        console.log("Agent manager disconnected");
        console.log('CLOSED: ' + sock.remoteAddress +' '+ sock.remotePort);
    });
    
    sock.on('error', function(error){
        console.log('error ecured '+ error);
    })

    sock.on('data', function(data) {
        console.log("do something")
        var val = JSON.parse(data);
        console.log(val); 
        if (AGENT_PORT == 4001){
            agent = require('./AgentManager')
            agent.AgentManager(val["country"]);;
        }
        else{
            agent = require('./AgentManagertest'); 
            agent.AgentManagertest(val["country"]);   
        }
	console.log(val) 
        agent.launchNewEchoAgent(val["gametype"], val["opponentRole"], val["role"], val["agent"], val["gameid"],val["country"]);
            
    });
});

//launchNewEchoAgent("negomenus_Neighbours", "Alex");
//launchNewEchoAgent("negomenus_JobCandidate", "Employer");

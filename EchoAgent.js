
/**
 * Other : Osnat Drain - osnatairy@gmail.com
 * Help with everything : Erel Segal Halevi - erelsgl@gmail.com
 * Initialize a new agent. 
 * @param socket - a socket.io client that this agent will use to connect to the negotiation server.
 */

var util = require('util');
var _ = require('underscore')._;

var ACCEPT = 5000;
var REJECT = 5000;
var NO_COMMENT = 5000;

var happy = ["I'm happy that you accept", "It's great that you agree", "It's good to reach an agreement on this"]
var happy_issue = ["I'm happy that you accept the", "It's great that we agreed on", "It's good to reach an agreement on"]

exports.Agent = function (name, agent, socket, role, gametype) {
  	var role = role;
	var agent = agent;
	var userid = this.userid = name + new Date().toISOString();
	var myLastBid;
	var oppLastBid = {};
	var curSratus;
	var gameid = gameid;
	var curTurn = 0;
	var gameIsOn = false;
	var agreed = false;
	var somethingHappend = false;
	var compromise = false;
	var offerSomething = false;
	var freeze = false; // to stop the agent in case when WOZ person is enabled
	var checkTurn = 1;
	var offers;
	var negoactions_count = 0
	var bid_is_empty = false
	var lastaccept = false
	agent.socket = socket;


	offers = setInterval(function(){
		console.log("______________________________________________")
		//after 25 seconds it checks if there were anything happend, if there weren't, he do the following:
		if (!somethingHappend && !compromise && !agreed && !freeze){
			//put into "temp" the next bid - offer of his.
			var temp = agent.pickBid(curTurn);
			if (temp){ // if he finds an offer
	
				console.log("temp")
			        console.log(JSON.stringify(temp, null, 4))
	
				if(temp == "done"){
					agreed = true;
					socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: agent.B_Rely, role: role});
					socket.emit("message", "I guess we discuss everything and we can sign the agreement.");
					return;
				}


				else if (checkTurn != curTurn){ // he checks if the turn was changed and if so he: 
					checkTurn = curTurn;
		
					console.log("temp")	
					console.log(temp)
					var equalTemp = true; //check if the current offer is like the one before

					if (myLastBid)		
						equalTemp = _.isEqual(temp, myLastBid)
	//				console.log("si "+si)
					
	//				for(issue in temp){
	//					console.log("issue "+ issue)
	//					if(myLastBid)
	//					{
	//						if(!myLastBid.hasOwnProperty(issue))
	//							equalTemp = false
	//						else
	//							if(temp[issue] =! myLastBid[issue])
	//								equalTemp = false;
	//					}
	//					else
	//					console.log("mylastbid doesn't exist")

					
					if (myLastBid)
					{
 						console.log("myLastBid")
						console.log(JSON.stringify(myLastBid, null, 4))
					}
//					}
					if (!equalTemp || !myLastBid){ // if the current offer isn't like the one befor or ther is no value in mylastbid he suggest the offer as usual
						myLastBid = temp;
						console.log("I change my decision")
						socket.emit('message', "Sorry, I changed my preferences");					
						socket.emit('negoactions', [{'Offer' :myLastBid}]);
						socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: myLastBid, role: role});
						return;

					}
					else{ //if the current offer is like the one befor he say the follow:
						var bidVal;
						var bidName;
						for (i in myLastBid){
							bidVal = myLastBid[i];
							bidName = i;
						}
						if (bid_is_empty)
						{
							socket.emit('negoactions', [{'Offer' :myLastBid}]);
							// socket.emit('message', "I am suggesting you " + bidName.toLowerCase() + " : " + bidVal.toLowerCase());							
							bid_is_empty = false
						}
						else
						{
							console.log("the same offer")
							socket.emit('negoactions', [{'Offer' :myLastBid}]);
							// socket.emit('message', "I am once again suggesting you " + bidName.toLowerCase() + " : " + bidVal.toLowerCase());
							bid_is_empty = false
						}
						return;
					}
					
				}
				else{ // if the turn havn't changed yet he offer as usual.
					if (negoactions_count >= 2) // offer the same stuff when the user made at least 2 utterances
					{
						myLastBid = clone(temp);
						console.log("the same turn")
						socket.emit('negoactions', [{'Offer' :myLastBid}]);
						socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: myLastBid, role: role});
						return;
					}
				}
			}
			else{
				if (temp == "done"){
					socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: agent.B_Rely, role: role});
					socket.emit('message', "I guess we discuss everything and we can sign the agreement");
				}
			}
			 // if the agent couldn't find any offer he wait to the next turn for the cluster to recalculate.
			if (!temp){
				// socket.emit('message', "Just a minute, I need to think a bit.");
				socket.emit('negoactions', [{"Query" : "Offer"}])
				console.log("What do you have to offer?")
				bid_is_empty = true
				return;
			}
		}
		somethingHappend = false;
		compromise = false;
		offerSomething = false

	},35000);

		
	socket.on('connect', function () { 
		setTimeout(function(){
				myLastBid = agent.pickBid(curTurn);
				socket.emit('message', "Hello. I would like to discuss the issues of my contract.");
				socket.emit('negoactions', [{'Offer' :myLastBid}]);
				socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: myLastBid, role: role});
				somethingHappend = true;
			},6000);
	});

	socket.on('status',function (status) { 
		if ((status.value == "0:00") || (!gameIsOn)){
			clearInterval(offers);
		}
		curStatus = status;
		agent.status = status.value;
	});

	socket.on("EndGame", function(){
   		socket.emit("giveMeMyReservationUtility");
   		clearInterval(offers);
   		socket.disconnect();
    });

    // when the text is send to translation freeze the agent
    socket.on('freeze', function(){
    	console.log("I am freezed")
   		freeze = true
    });

    socket.on('unfreeze', function(){
    	console.log("I am unfreezed")
   		freeze = false
    });

	socket.on('EndTurn', function (turn) {
		if (curTurn !== turn){
			agent.recalculateSearchCluster(turn);
			curTurn = turn;
		}
	});

	socket.on('announcement', function (announcement) { 
		if (announcement.action == 'Connect')
			gameIsOn = true;
		if (announcement.action == 'Disconnect'){
			gameIsOn = false;
			clearInterval(offers);
			socket.disconnect();

		}
	});

	socket.on('negoactions', function (actions) { 

		negoactions_count += 1
		somethingHappend = true;
		var newOppBid = {};
		if (actions.hasOwnProperty('Reject')){ // the opponent reject the agent's offer
			if (myLastBid==null){ 
					socket.emit('message', "What do you reject?");
			}

			else{
				var extchangeOffer;

				console.log("--------------Reject--------------")
				console.log(actions.Reject)
				console.log("myLastBid")
				console.log(myLastBid)
				console.log("oppLastBid")
				console.log(oppLastBid)

				if (["previous",true,"true"].indexOf(actions.Reject)!=-1){
				// if (actions.Reject == "previous"){
					extchangeOffer = agent.opponentRejected(myLastBid, curTurn);
				}
				else{

					if (_.isObject(actions.Reject) && !_.isArray(actions.Reject))
						actions.Reject = _.keys(actions.Reject)

					extchangeOffer = agent.opponentRejected(actions.Reject, curTurn);
				}

				console.log("extchangeOffer")
				console.log(JSON.stringify(extchangeOffer))

				setTimeout(function(){
					if(extchangeOffer){
						if(extchangeOffer == "not exist")
						{
						        socket.emit('message', "What do you reject?");
							return;
						}
						else if (!(isEqual(extchangeOffer[0], myLastBid)) && !(isEqual(extchangeOffer[0], oppLastBid))){
							myLastBid = {}
							console.log("loop")
							for(var i=0; i<extchangeOffer.length; i++){
								console.log(JSON.stringify(extchangeOffer[i]))
								if(extchangeOffer[i].valueOf("Object")){
									for (val in (extchangeOffer[i])){
										util._extend(myLastBid, extchangeOffer[i][val]);
									}
								}
							}
							if (!actions.hasOwnProperty('Offer') && !offerSomething){
								if(extchangeOffer){
									socket.emit('negoactions', extchangeOffer);
									socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: myLastBid, role: role});
									return;
								}
								else{
									socket.emit('negoactions', [{"Query" : "Offer"}])
									// socket.emit('message', "OK, what do you have to offer about other issues?");
									return;

								}
							}
						}
					}
					else{
						socket.emit('negoactions', [{"Query" : "Offer"}])
						// socket.emit('message', "OK, what do you have to offer about other issues?");
						return;
					}

					offerSomething = false;
					somethingHappend = true;
				},4000);
			}
		}

		if (actions.hasOwnProperty('Quit')){
			socket.emit('message', "I am opting out. Please press the button Opt out.");
			socket.emit("giveMeMyReservationUtility");
   			clearInterval(offers);
   			socket.disconnect();
   		}

		if (actions.hasOwnProperty('Query')){
			console.log("Query")
			console.log(actions.Query)

			if ((actions.Query == "Offer") || (actions.Query == "Accept"))
			{
				console.log("single query is here")
				console.log(actions.Query)
				
				setTimeout(function(){
					myLastBid = agent.pickBid(curTurn);
					if (myLastBid){
						socket.emit('negoactions', [{'Offer' :myLastBid}]);
						socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: myLastBid, role: role});
					}
					else{
						socket.emit('message', "I am sorry I cannot come up with the offer right now?");
						socket.emit('negoactions', [{"Query" : "Offer"}])
					}
					somethingHappend = true;
				},3000);
			}

			if (_.isObject(actions.Query))
			{
				console.log("compound query is here")

				_.each(_.values(actions.Query), function(value, key, list){
					setTimeout(function(){
						var myLastBid1 = agent.pickSpecificBidForYou(curTurn, value);
						if(myLastBid1){
							myLastBid = myLastBid1;
							socket.emit('negoactions', [{'Offer' :myLastBid}]);
						}
						else
							socket.emit('massage', "I suggest you to offer something");
						socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: myLastBid, role: role});
						somethingHappend = true;
					},3000);
				})
			}
				// case "issues":{
				// 	setTimeout(function(){
				// 		var massage = agent.pickIssueForYou(curTurn);
				// 		if(massage)
				// 			socket.emit('message', massage);
				// 		somethingHappend = true;
				// 	},3000);
				// 	break;
				// }
				// case "compromise":{
				// 	compromise = true;
				// 	setTimeout(function(){
				// 		var comp = agent.tryToCompromise();
				// 		if (comp != undefined){
				// 			myLastBid = comp;
				// 			socket.emit('negoactions', [{'Offer' :myLastBid}]);
				// 			socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: myLastBid, role: role});
				// 		}
				// 		else{
				// 			socket.emit('message', "What are you willing to compromise?");
							

				// 		}
				// 		somethingHappend = true;
				// 		compromise = true;
				// 	},3000);
				// 	break;
				// }
				// case "accept":{
				// 	break;
				// }
				// default:{
				// 	setTimeout(function(){
				// 		var myLastBid1 = agent.pickSpecificBidForYou(curTurn, Query);
				// 		if(myLastBid1){
				// 			myLastBid = myLastBid1;
				// 			socket.emit('negoactions', [{'Offer' :myLastBid}]);
				// 		}
				// 		else
				// 			self.socket.emit('massage', "I suggest you offer something");
				// 		socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: myLastBid, role: role});
				// 		somethingHappend = true;
				// 	},3000);
				// 	break;
				// }
		}

		if (actions.hasOwnProperty('Accept')){ // the opponent accept the agent's offer
			if (myLastBid==null){ 
				socket.emit('message', "What do you accept?");
				console.error("What do you accept? myLastBid is null");
			}
			else{
				var issueName = actions.Accept
				// if (issueName == "previous"){
				if (["previous",true,"true"].indexOf(issueName)!=-1){
					util._extend(newOppBid, myLastBid);
				}
				else {
					if (!(issueName instanceof Array)){
						issueName = [issueName];
						//console.log(issueName);
					}

					for(var i = 0; i < issueName.length; i ++){

						if (_.isObject(issueName[i]))
						{
							var elem = _.pairs(issueName[i])
							if (elem[0][0] in myLastBid)
								{
								if (myLastBid[elem[0][0]]==elem[0][1])
									newOppBid[elem[0][0]]=myLastBid[elem[0][0]];
								else
								{
									socket.emit('message', "How can you accept my offer about the value that wasn't offered");
									console.error("Non-offered value was accepted.\nissueName="+JSON.stringify(issueName[i])+"\n myLastBid= "+JSON.stringify(myLastBid))
								
								}
								}
							else
							{
								socket.emit('message', "How can you accept my offer about the attribute that wasn't offered");
								console.error("Non-offered attribute was accepted.\nissueName="+JSON.stringify(issueName[i])+"\n myLastBid= "+JSON.stringify(myLastBid))

							}
						}
						else
						{
							if (issueName[i] in myLastBid) 
								newOppBid[issueName[i]]=myLastBid[issueName[i]];
							else
							{
								socket.emit('message', "How can you accept my offer about '"+JSON.stringify(issueName[i])+"'. when I even haven't offered it yet?");
								console.error("How can you accept my offer about '"+JSON.stringify(issueName[i])+"'. when I even haven't offered it yet?")
								console.error(JSON.stringify(issueName[i]))
								console.error(JSON.stringify(myLastBid))
							}
						}
					}
				}
			}
			lastaccept = true
			console.log("Accept came")
			console.log(JSON.stringify(newOppBid, null, 4))
		}

		if (actions.hasOwnProperty('Insist')){ // come as array and not as object - change it if it array do it else make it array. same in the accept
			if (oppLastBid==null){  //add the loop of the accept her too after I'll add the check of the arrays
					// socket.emit('message', "What do you insist?");
			}
			else{
				var issueName = actions.Insist
				if (["previous",true,"true"].indexOf(issueName)!=-1){
					util._extend(newOppBid, oppLastBid);
				}
				else {
					if (!(issueName instanceof Array)){
						issueName = [issueName];
					}
					for(var i = 0; i < issueName.length; i ++){
						if (_.isObject(issueName[i]))
						{
							var elem = _.pairs(issueName[i])
							newOppBid[elem[0][0]]=elem[0][1]
						}
						else
						{
							if (!(issueName[i] in oppLastBid)) {
								// socket.emit('message', "How can you insist my offer about '"+issueName[i]+"'. when you even haven't offered it yet?");
								console.error("How can you inssit my offer about '"+issueName[i]+"'. when you even haven't offered it yet?")
							} else {
								newOppBid[issueName[i]]=oppLastBid[issueName[i]];
							}
						}
					}
				}				
			}
			
		}

		if (actions.hasOwnProperty('Append')){ // come as array and not as object - change it if it array do it else make it array. same in the accept
			if (oppLastBid==null){  //add the loop of the accept her too after I'll add the check of the arrays
					socket.emit('message', "What do you append?");
			}
			else{
				var issueName = actions.Append
				if (issueName == "previous"){
					util._extend(newOppBid, oppLastBid);
				}
			}
		}

		if (actions.hasOwnProperty('Offer')){ // 'Offer in actions
			util._extend(newOppBid, actions.Offer);
			offerSomething = true;
			lastaccept = false
			console.log("Offer came")
			console.log(JSON.stringify(newOppBid, null, 4))
		}

		if (actions.hasOwnProperty('Greet')){ 
			// socket.emit('negoactions', [{'Greet': true}]);
		}

		if (Object.keys(newOppBid).length==0) {  // only greet
			return;
		} else {
			var equal = true;
			if(myLastBid){
				for (issue in newOppBid){
					if(myLastBid){
						if (!myLastBid.hasOwnProperty(issue)) 
							equal = false;
						else
							if (myLastBid[issue] != newOppBid[issue])
								equal = false;
					}
				}
				for (issue in myLastBid){
					if (!newOppBid.hasOwnProperty(issue)) 
						equal = false;
					else
						if (myLastBid[issue] != newOppBid[issue])
							equal = false;
				}
			}
			else{
				equal = false;
			}

			console.log("equal accept")
			console.log(equal)

			if (equal) { // full accept
				var accept = agent.opponentAccepted(myLastBid, curTurn);
				
				console.log("in case of equal true")
				console.log("opponentAccepted")
				console.log(JSON.stringify(accept, null, 4))

				socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: myLastBid, role: role});
				setTimeout(function(){
					if (accept == "done"){
						socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: agent.B_Rely, role: role});
						socket.emit('message', "I'm happy that you accept. We can sign the agreement now. Please pick the values in the agreement draft and press Sign.");
						agreed = true;
						return;
					}
					else{
						if (accept){
							// socket.emit('message', "I'm happy that you accept."+JSON.stringify(myLastBid));
							console.log("I am here to say happy")							
							console.log(actions.Accept)

							if (!_.isObject(actions.Accept) && (actions.Accept!=true) && (!_.isUndefined(actions.Accept)))
								socket.emit('message', happy_issue[_.random(0,happy.length-1)]+" "+actions.Accept.toLowerCase());
							else if (_.isObject(actions.Accept))
							{
								if (_.keys(actions.Accept).length==1)
									socket.emit('message', happy_issue[_.random(0,happy_issue.length-1)]+" "+_.values(actions.Accept)[0].toLowerCase());
							}
							else
								socket.emit('message', happy[_.random(0,happy.length-1)]);

							socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: myLastBid, role: role});
						
							myLastBid = {};
							var haveOffer = false;

							for(var i=0; i<accept.length; i++){
								if(accept[i].valueOf("Object")){
									for (val in (accept[i])){
										if(val == 'Offer'){
											haveOffer = true;
											util._extend(myLastBid, accept[i][val]);
										}
									}
								}
							}
							if(haveOffer){
								socket.emit('negoactions', accept);
								socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: myLastBid, role: role});
							}
						}
					}
					somethingHappend = true;
				},3000);
			} 
			else {  // partial accept and/or new offers
				console.log("in case of equal false")
				offerSomething == true;
				agentReplyAction = agent.checkBid(newOppBid, curTurn, lastaccept, socket);
				lastaccept = false
				console.log(JSON.stringify("newOppBid", null, 4))
				console.log(JSON.stringify(newOppBid, null, 4))
				
				console.log(JSON.stringify("agentReplyAction", null, 4))
				console.log(JSON.stringify(agentReplyAction, null, 4))
				oppLastBid = clone(newOppBid);
				setTimeout(function(){
					if (agentReplyAction){ 

						for(var i=0; i<agentReplyAction.length; i++){
							if(agentReplyAction[i].valueOf("Object")){
								for (val in (agentReplyAction[i])){
									if(val == "Offer"){
										myLastBid= clone(agentReplyAction[i][val]);
										socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: myLastBid, role: role});
									}
									if(val == 'ChangeIssue'){
										util._extend(myLastBid, agentReplyAction[0]['Accept']);
										socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: myLastBid, role: role});
										socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: agent.B_Rely, role: role});
									}
									if(val == 'StartNewIssue'){
										socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: oppLastBid, role: role});
										myLastBid = clone(oppLastBid);
									}
									if(val == 'currentAgreement'){
										socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: agentReplyAction[i][val], role: role});
										myLastBid = clone(oppLastBid);
										agentReplyAction.splice(i,1);
										i--;

									}
								}
							}
						}
						if(agent.B_Rely)
							socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: agent.B_Rely, role: role});
						socket.emit('negoactions', agentReplyAction);
					}
					somethingHappend = true;
				},4000);
			}
		}
	});
	
	socket.on('sign', function (data) { //the agent allwas sign after the opponent so we won't get to infinit loop.
		var proposer = data.id + (data.you? " (You)": "");
		socket.emit('sign' ,data.agreement );
		clearInterval(offers);
		socket.disconnect();
	});

	socket.on('yourPartnerOpt-out', function (){
		socket.emit('opt-out', true);
		clearInterval(offers);
		socket.disconnect();
	});

	socket.on("EndGame", function(){
		socket.emit("giveMeMyReservationUtility");
		clearInterval(offers);
		socket.disconnect();
	});

	socket.on('Disconnect', function (status) {
		clearInterval(offers); 
	});
}

function clone(obj){
    if(obj == null || typeof(obj) != 'object'){
      return obj;
    }
    else{
	    var temp = obj.constructor(); // changed
	    for(var key in obj)
	        temp[key] = clone(obj[key]);
	    return temp;
   }
}

function isEqual(obj1, obj2){
	var equal = true;
	for (i in obj1){
		if(obj2.hasOwnProperty(i)){
			if(obj1[i] != obj2[i])
				equal = false;
		}
		else
			equal= false;
	}
	for (i in obj2){
		if(obj1.hasOwnProperty(i)){
			if(obj1[i] != obj2[i])
				equal = false;
		}
		else
			equal= false;
	}
	return equal;
}

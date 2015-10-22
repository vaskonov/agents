

module.exports = ChatAgent;
var logs = require('../logs');
var fs = require('fs');
var nl = require('os').EOL;

var Analysis = require('../analysis/analysis');
var UtilitySpace = require('../analysis/utilitySpace');
var logger = require('../logger')
var OpponentData = require('../analysis/opponentData');
var PRECISION_VALUE = 0.3  // used in order to scale utilities and make them positive



function ChatAgent(domain, role, oppRole, gameid,country) {
  this.domain = domain;
  this.role = role;
  this.oppRole = oppRole;
  this.numOfBids = 0;
  this.socket;
  this.posibleOpponent = new Array();
  this.myUtilityShort = new UtilitySpace(domain.agentsByOwnerAndPersonality[role.toLowerCase()]['short-term'].utility_space_object);
  this.oppUtilityShort = new UtilitySpace(domain.agentsByOwnerAndPersonality[oppRole.toLowerCase()]['short-term'].utility_space_object);
  this.oppUtilityComp = new UtilitySpace(domain.agentsByOwnerAndPersonality[oppRole.toLowerCase()]['comp-romise'].utility_space_object);
  this.oppUtilityLong = new UtilitySpace(domain.agentsByOwnerAndPersonality[oppRole.toLowerCase()]['long-term'].utility_space_object);
  this.issuesLength; //the issues' number.
  this.currOpponent = 0;// the 
  this.nik; //the nikname of the current opponent type.
  this.searchCluster;
  this.constForThreshold = 150; //for now i subtracts that value from the agent threshold - should be another value for that
  this.status;
  this.A = readAspirationFile();
  this.issueLength = clone(this.A);
  this.B = [];
  this.B_temp = [];
  this.discuss = [];
  this.turn;
  this.gameid = gameid;
  this.status;
  this.wait = false;
  this.country = country;
  this.oppReaction = false;
}

ChatAgent.prototype = {
  initializeBids: function (domain){
    this.issuesLength = domain.issues.length;
    var items = new Array(this.issuesLength);   
    for (var i = 0; i < this.issuesLength; i++) {
      var a = domain.issues[i].$.name;
      items[i] = [];
      items[i]["name"] = a;
      items[i]["value"] = [];
      
      for ( var j = 0; j < domain.issues[i].item.length; j++) {

        items[i]["value"][j] = domain.issues[i].item[j].$.value;
      }
    };
    analysis = new Analysis(items);
    this.sumUtilMe = 0;
    this.sumUtilOppShort = 0;
    this.sumUtilOppComp = 0;
    this.sumUtilOppLong = 0;
    var a = analysis.hasNext();
    var b = analysis.makeNextIndex();
    var bids = new Object();
    while (analysis.hasNext()){
      this.numOfBids++;
      bids[this.numOfBids] = {};
      var bid = analysis.next();
      bids[this.numOfBids].bid = bid;
      bids[this.numOfBids].utilMe = Math.round(this.myUtilityShort.getUtility(bid));
      this.sumUtilMe += bids[this.numOfBids].utilMe;
      bids[this.numOfBids].utilOppShort = Math.round(this.oppUtilityShort.getUtility(bid));
      this.sumUtilOppShort += Math.exp(bids[this.numOfBids].utilOppShort* PRECISION_VALUE);
      bids[this.numOfBids].utilOppComp = Math.round(this.oppUtilityComp.getUtility(bid));
      this.sumUtilOppComp += Math.exp(bids[this.numOfBids].utilOppComp * PRECISION_VALUE);
      bids[this.numOfBids].utilOppLong = Math.round(this.oppUtilityLong.getUtility(bid));
      this.sumUtilOppLong += Math.exp(bids[this.numOfBids].utilOppLong * PRECISION_VALUE);
    }
    this.initBids = bids;
    this.oppUtilityShort.AvrageValuesPerIssue = this.posibleOpponent[0].AvrageValuesPerIssue;    
    this.oppUtilityComp.AvrageValuesPerIssue = this.posibleOpponent[1].AvrageValuesPerIssue;
    this.oppUtilityLong.AvrageValuesPerIssue = this.posibleOpponent[2].AvrageValuesPerIssue;
  },

  initializeChatAgent: function (){
    var self = this;
    if (self.oppRole == 'Employer'){
      self.posibleOpponent.push(new OpponentData('A', 'ShortTerm', 'Short', self.country));
      self.posibleOpponent.push(new OpponentData('A', 'Compromise', 'Comp', self.country));
      self.posibleOpponent.push(new OpponentData('A', 'LongTerm', 'Long', self.country));
    }
    else {
      self.posibleOpponent.push(new OpponentData('B', 'ShortTerm', 'Short', self.country));
      self.posibleOpponent.push(new OpponentData('B', 'Compromise', 'Comp', self.country));
      self.posibleOpponent.push(new OpponentData('B', 'LongTerm', 'Long', self.country));
    }


    self.currOpponent = Math.round(Math.random() * 2);
    self.nik = self.posibleOpponent[self.currOpponent].nikName;
    for (var i = 0; i < self.posibleOpponent.length; i++){
      self.posibleOpponent[i].probability = 1/self.posibleOpponent.length;
      self.posibleOpponent[i].calcProbability = 1/self.posibleOpponent.length;
    }
  },

  pickFirstBid: function (turn){ 
  //use this function to pick the 
  //next bid to offer according to the A stuck
    var self = this;
    offerOut =[];
    self.turn = turn;
    self.temp = self.findValue();
    if(self.temp){
      for(offer in self.temp.bid){
        self.B_temp[self.B_temp.length] = {};
        self.B_temp[self.B_temp.length-1].name = offer;
        self.B_temp[self.B_temp.length-1].value = self.temp.bid[offer];
      }
      return self.temp.bid;
    }
  },

  pickBid: function (turn){ 
  //use this function to pick the 
  //next bid to offer according to the A stuck
    var self = this;
    var bOver = convertBToObject(self.B);
    self.B_temp = clone(self.B); // when I suggest an offer I put into temp_b = B, so if the opp did not say anithing and i should offer the same thing again, the offer will not appear twice in temp_b.
    self.turn = turn;
    var isGoleInB = false;
    if (self.gole){
      for (var i = 0; i < self.B.length; i++) {
        if (self.B[i].name == self.gole)
          isGoleInB = true;
      };
    }

    if (self.A.length > 0){ //if A.length is bigger than 0 it is mean that there are more issues to discuss on.
      if (isGoleInB || !self.gole){
        logs.writeJsonLogGame(self.gameid, self.status, "offer the first value of ", self.A);
        self.gole = self.A[0];//the first issue to discuss on
      }
      
      var goleR = self.checkIfExist();
      if (goleR){
        var isInDiscuss = false;
        for(var i = 0; i < self.discuss.length; i++){
          if(self.discuss[i].name == self.gole){
            isInDiscuss = true;
            if (self.discuss[i].lastOffer != goleR[self.gole])
              self.discuss[i].lastOffer = goleR[self.gole]
          }
        }
        if(!isInDiscuss){
          var pushToDiscuss = {};
          pushToDiscuss.name = self.gole;
          pushToDiscuss.lastOffer = goleR[self.gole];
          self.discuss.push(pushToDiscuss);
        }
        return (goleR);
      }
      else
        return;
    }
    else{//we have discuss everything and can sign the agreement
       //verify that each issue was discuss and is inside B.
      var notFinish = false;
      for (var i = 0; i < self.issueLength.length; i++) {
        var checkIfDone = false;
        for (var j =  0 ; j< self.B.length ;j++) {
          if(self.B[j].name == self.issueLength[i])
            checkIfDone = true;
        };
        if (!checkIfDone){
          self.A.push(self.issueLength[i])
          notFinish = true;
          continue;
        }
      }
     
      if (!notFinish){
        self.socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: bOver, role: self.role});
        return "done";
      }       
      else
        return;
    }
  },

  checkIfFinish: function(){
  //we have discuss everything and can sign the agreement
  //verify that each issue was discuss and is inside B.
    var self = this;
    console.dir(self.A);
    var notFinish = false;
    for (var i = 0; i < self.issueLength.length; i++) {
      var checkIfDone = false;
      for (var j =  0 ; j< self.B.length ;j++) {
        if(self.B[j].name == self.issueLength[i])
          checkIfDone = true;
      }
      if (!checkIfDone){
        notFinish = true;
        var inA = false;
        for(var k = 0; k< self.A.length; k++){
          if (self.A[k] == self.issueLength[i]){
            inA = true;
          }
        }
        if (!inA){
          self.A.push(self.issueLength[i])
        }
      }
    }
    return notFinish;
  },

  checkIfExist: function(){
    var self = this;
    self.temp = self.findValue();
    if (self.temp){
      self.B_temp[self.B_temp.length] = {}
      self.B_temp[self.B_temp.length-1].name = self.gole;
      self.B_temp[self.B_temp.length-1].value = self.temp.bid[self.gole];
      var goleR = {}
      goleR[self.gole] = self.temp.bid[self.gole];
      logs.writeJsonLogGame(self.gameid, self.status, "the agent's offer is ", goleR);
      return (goleR);
    }
  },

  tryToCompromise: function(){
    var self = this;
    self.B_temp = clone(self.B);
    if (self.discuss.length > 0){
      self.gole = self.discuss[0].name;
      self.removeFromSearchCluster(self.discuss[0].lastOffer);// remove the current gole which the opponent rejected
      self.temp = self.findValue();  //try to find a bid without the gole the opponent reject               
      if (self.temp){
        for (var i = 0; i<self.B_temp.length; i++){
          if (self.B_temp[i].name == self.gole)
            self.B_temp[i].value = self.temp.bid[self.gole];
            
        }
        for (var i = 0; i<self.discuss.length; i++){
          if (self.discuss[i].name == self.gole)
            self.discuss.lastOffer = self.temp.bid[self.gole];
            
        }
        var goleR = {}
        goleR[self.gole] = self.temp.bid[self.gole];
        for(var i = 0; i < self.discuss.length; i++){
          if(self.discuss[i].name == self.gole){
            if (self.discuss[i].lastOffer != goleR[self.gole])
              self.discuss[i].lastOffer = goleR[self.gole]
          }
        }
        logs.writeJsonLogGame(self.gameid, self.status, "the opponent want the agent to comromise and the agent's new offer is ", goleR);
        return (goleR);
      }
      else
        return;
    }
    else
      return;
  },

  pickSpecificBidForYou: function(turn, issueToTalk){ 
    var self = this;
    var is = false;
    for(var i = 0; i<self.B.length; i++){
      if(self.B[i].name == self.gole){
        is = true;
      }
      if(self.B[i].name == issueToTalk){
        self.A.push(issueToTalk);
        self.B.splice(i, 1);
        i--;
      }
    }
    self.B_temp = clone(self.B);
    self.gole = issueToTalk;
    var goleR = self.checkIfExist();

    if (goleR){
      for(var i = 0; i < self.discuss.length; i++){
        if(self.discuss[i].name == self.gole){
          if (self.discuss[i].lastOffer != goleR[self.gole])
            self.discuss[i].lastOffer = goleR[self.gole]
        }
      }
      return (goleR); 
    }
    else{
      self.socket.emit('massage', "I suggest you offer something");
      return;
    }
  },


  pickIssueForYou: function(turn){
  //when the user asks the agent "what the next issue to duscuss" 
  //he brings the next issue to discuss on   
    var self = this;
    var isGoleInB = false;
    for(var i = 0; i<self.B.length; i++){
      if(self.B[i].name == self.gole)
        isGoleInB = true;
    }
    if (isGoleInB){
       var a_t = self.A[0];
       self.socket.emit('message', "Let's talk about " + a_t );
    }
    else{
      self.socket.emit('message', "Let's talk about " + self.gole );
    }
  },

  findValue: function (){
    var self = this;
    var maxUtility = -1000;
    var currBid = undefined;
    for (bid in self.searchCluster){
      var flag = true;
      if (Object.keys(self.B).length != 0){
        for (val in self.B){
          if (self.searchCluster[bid].bid[self.B[val].name] != self.B[val].value)
            flag = false;
        }
      }
      if(self.searchCluster[bid].utilMe > maxUtility && flag){
          maxUtility = self.searchCluster[bid].utilMe;
          currBid = self.searchCluster[bid];
      }
    }
    return currBid;
  },

  findValueWithOffer: function (offer){
    var self = this;
    var maxUtility = -1000;
    var currBid = undefined;
    for (bid in self.searchCluster){
      var flag = true;
      var flag2 = true;
      if (Object.keys(self.B).length != 0){
        for (val in self.B){
          if (self.searchCluster[bid].bid[self.B[val].name] != self.B[val].value)
            flag = false;
        }
      }
      for (issue in offer){
        if (self.searchCluster[bid].bid[issue] != offer[issue])
          flag2 = false;
      }
      if(self.searchCluster[bid].utilMe > maxUtility && flag && flag2){
          maxUtility = self.searchCluster[bid].utilMe;
          currBid = self.searchCluster[bid];
      }
    }
    return currBid;
  },

  recalculateSearchCluster: function(turn){
    var self = this;
    agentThreshold = this.posibleOpponent[this.currOpponent].agentAcceptThersholds[turn];

    if (!agentThreshold)
      agentThreshold = this.posibleOpponent[this.currOpponent].agentAcceptThersholds[Object.keys(this.posibleOpponent[this.currOpponent].agentAcceptThersholds).length-1];
    logs.writeJsonLogGame(self.gameid, self.status, "the agent threshold for the " + turn +"turn is ", agentThreshold);
    oppThreshold = agentThreshold - this.constForThreshold;
    self.searchCluster = [];
    var i = 0;
    for (bid in this.initBids){
      var utilAgentForTurn = self.myUtilityShort.getUtilityWithDiscount(self.initBids[bid].utilMe , turn); 
      if (utilAgentForTurn > agentThreshold && self.initBids[bid]['utilOpp'+self.nik] > oppThreshold){
        self.searchCluster[i] = self.initBids[bid];
        i++;
      }
    }
  },

  opponentAccepted: function (offer, turn){
    var self = this;
    self.oppReaction = true;
    for (val in offer){
      var isGoleInB = false;
      for (var i = 0; i <self.B.length; i ++){
        if (self.B[i].name == val){
          isGoleInB = true;
          self.B[i].value = offer[val];
        }

      }
      if(!isGoleInB){
        self.B[self.B.length] = {}
        self.B[self.B.length-1].name = val;
        self.B[self.B.length-1].value = offer[val];
      }
    }

    var bobj = convertBToObject(self.B);
    
    for (var j = 0; j < self.B.length; j++){
      for (var i = 0; i< self.A.length; i++){
        if (self.A[i] == self.B[j].name){
          self.A.splice(i, 1);
          i--;
        }
      }
      for (var i = 0; self.discuss.length <i; i++){
        if (self.discuss[i] == self.B[j].name){
          self.discuss.splice(i, 1);
          i--;
        }
      }
    }

    
    self.socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: bobj, role: self.role});
    logs.writeJsonLogGame(self.gameid, self.status, "the opponent agreed on the agent's offer. the current agreement is: ", self.B);
    logs.writeJsonLogGame(self.gameid, self.status, "BASED ON THAT BID ", self.temp);
    logs.writeJsonLogGame(self.gameid, self.status, "left to agree on: ", self.A);
    var finish = self.checkIfFinish();
    if ((self.A.length == 0) && finish){


      return "done";
    }
    else{
      var offerWithAccept =self.pickBid(self.turn); 
      if (offerWithAccept)
        return ([{"Offer" : offerWithAccept}]);
      else
        return;
    }
  },

  removeFromSearchCluster: function (value){
    var self = this;
    for (i = 0; i < self.searchCluster.length; i++){
      var exist = false;
      for (val in self.searchCluster[i].bid){
        if (self.searchCluster[i].bid[val] == value)
          exist = true;
        if (self.B.length > 0 && !exist){
         for(var j=0; j< self.B.length; j++){
          if (val == self.B[j].name)
            if (self.searchCluster[i].bid[val] != self.B[j].value)
              exist = false;
          }
        }
      }
      if (exist){
        self.searchCluster.splice(i, 1);
        i--;
      }
    }
  },

  calcRejectionProbabilities: function(name, prevOfferValue, prevTypeProbability){
    var self = this;
    var offerValue = 0;
    var offerProbability = 0;
    var offerSum = 0;
    for (var i = 1; i<=self.numOfBids ; i++){
      if (self.initBids[i]['utilOpp'+name] >= prevOfferValue){
        offerValue = Math.exp(self.initBids[i]['utilOpp'+name] * PRECISION_VALUE);
        offerProbability = offerValue/ self['sumUtilOpp'+name];
        offerSum += (offerProbability * prevTypeProbability);
      }
    }
    return offerSum;
  },

  findCurrBid: function(offer){
    for( var i = 1; i <= this.numOfBids; i++){
      var checkEachBid = true;
      for (issue in this.initBids[i].bid){
        if (offer[issue.toLowerCase()] != undefined){
          if ((offer[issue.toLowerCase()]).toLowerCase() != (this.initBids[i].bid[issue]).toLowerCase())
              checkEachBid = false;
        }
        else{
          if ((offer[issue]).toLowerCase() != (this.initBids[i].bid[issue]).toLowerCase())
              checkEachBid = false;
        }
      }
      if (checkEachBid){
        return i;
      }
    }
  },

  checkOpponent: function(turn, offer){
   
    var self = this;
    
    var sumProbabilities = 0;
    var curr = 0;  
    var prevTypeProbability = 0;
    var prevOfferValue = 0;
    var prevOfferProbability = 0;
    var updatedTypeProbability = 0;

      for (var i = 0; i < self.posibleOpponent.length; i++){ 
        var name = self.posibleOpponent[i].nikName; //the nik name of current opponent
        prevTypeProbability = self.posibleOpponent[i].probability;
        var ut = self['oppUtility'+name].getUtility(offer);
        prevOfferValue = self['oppUtility'+name].getUtilityWithDiscount(ut, turn); //calculate the utility with discount.
        prevOfferValue = Math.exp(prevOfferValue * PRECISION_VALUE);
        prevOfferProbability = prevOfferValue / self['sumUtilOpp'+name] //calculate the luc number of the current offer
        sumProbabilities += prevOfferProbability * prevTypeProbability;  // add the numerator of the calculation of the probability
      } 

      for (var i = 0; i < self.posibleOpponent.length; i++){

        var name = self.posibleOpponent[i].nikName; //the nik name of current opponent
        prevTypeProbability = self.posibleOpponent[i].probability;
        var ut = self['oppUtility'+name].getUtility(offer);
        prevOfferValue = self['oppUtility'+name].getUtilityWithDiscount(ut, turn); //calculate the utility with discount.
        prevOfferValue = Math.exp(prevOfferValue * PRECISION_VALUE);
        prevOfferProbability = prevOfferValue / self['sumUtilOpp'+name] //calculate the luc number of the current offer

        updatedTypeProbability = (prevOfferProbability * prevTypeProbability) / sumProbabilities;

        self.posibleOpponent[i].probability =  updatedTypeProbability;//the new probability
       }
       self.currOpponent  = 0;
       for (var i = 0; i < self.posibleOpponent.length; i++){
        if (self.posibleOpponent[i].probability > self.posibleOpponent[self.currOpponent].probability){
          self.currOpponent = i;
          self.nik = self.posibleOpponent[i].nikName;
        }
      }
  },

  pikBestOffer: function(offer){
    var self = this;
    var offer1 = {};
    var offer2 = {};
    for (issue in offer){
      if (typeof(offer[issue]) == "object"){
        offer1[issue] = (offer[issue])[0];
        offer2[issue] = (offer[issue])[1];
      }
      else{
        offer1[issue] = (offer[issue]);
        offer2[issue] = (offer[issue]);
      }

    }
    if(self.myUtilityShort.getPartialUtility(offer1) > self.myUtilityShort.getPartialUtility(offer2))
      return offer1;
    else
      return offer2;
  },

  makeFullOffer: function(offer){
    var self = this;
    var currOppUtil = this['oppUtility'+ self.nik].getUtility(offer);
    return currOppUtil;
  },

  checkBid: function (offer, turn){
    var self = this;

    logs.writeJsonLogGame(self.gameid, self.status, "opponent offer this! ", offer);
    var len = 0;
    for (var o in offer) {
        len++;
    }
    // check if the bid is full.
    if (len ==  self.issuesLength) {
      // find the number of the current bid.
      var bidNum = self.findCurrBid(offer);
      var currUtil = self.initBids[bidNum]['utilOpp'+self.nik]
      self.checkOpponent(turn, offer);
      var currUtil = self['oppUtility'+self.nik].getUtilityWithDiscount(self.initBids[bidNum]['utilOpp'+self.nik], turn);
      var myUtility = self['myUtilityShort'].getUtilityWithDiscount(self.initBids[bidNum]['utilMe'], turn);
      if(myUtility >= this.posibleOpponent[this.currOpponent].agentAcceptThersholds[turn]) 
          return ([{"Accept" : offer}]);
      else
          return ([{"Reject" : offer}]);
    }
    //if the bid is not full do the follow - the NegoAgent.
    else{
       //if there is a dubble offer like 8 or 9 hours pick the best for the agent.
      if (doubleBid(offer)){
        offer = self.pikBestOffer(offer);
      }
      if(!self.oppReaction) {
        console.log("first opponent reaction");
        self.oppReaction = true;
        for(var i =0; i<self.B_temp.length;i++){
          var isInTemp = false;
          for (issue in offer){
            if (self.B_temp[i].name == issue){
              isInTemp = true;
            }
          }
          if(!isInTemp){
            for (var j = 0 ;j< self.A.length;j++){
              if(self.B_temp[i].name == self.A[i]){
                self.A.splice(i, 1);
              }
            }
            self.B[self.B.length] = {}
            self.B[self.B.length-1].name = self.B_temp[i].name;
            self.B[self.B.length-1].value = self.B_temp[i].value;
          }
        }
      }
      else{
        var isInDiscuss = false;
        for(var i = 0; i < self.discuss.length; i++){
          for (issue in offer){
            if(self.discuss[i].name == issue){
              isInDiscuss = true;
              if (self.discuss[i].lastOffer != offer[issue])
                self.discuss[i].lastOffer = offer[issue];
            }
          }
        }
        if(!isInDiscuss){
          for (issue in offer){
            var pushToDiscuss = {};
            pushToDiscuss.name = issue;
            pushToDiscuss.lastOffer = offer[issue];
            self.discuss.push(pushToDiscuss);
          }
        }
             //if the offer was negotiate before teke it out from B.
        for (issue in offer){
          for (var i = 0; i< self.B.length; i++){
             if (self.B[i].name == issue){
                self.B.splice(i, 1); 
                i--;
             }
          }
          for (var i = 0; i< self.B_temp.length; i++){
             if (self.B_temp[i].name == issue){
                self.B_temp.splice(i, 1);
                i--; 
             }
          }
        }
      }


      for (var i = 0; i < self.issueLength.length; i++) {
        var checkIfDone = false;
        for (var j =  0 ; j< self.B.length ;j++) {
          if(self.B[j].name == self.issueLength[i])
            checkIfDone = true;
        };
        if (!checkIfDone){
          self.A.push(self.issueLength[i])
          
          continue;
        }
      }
      // when the opponent offer something, the agent looking for an acceptable bid 
      //in the search cluster.
      self.temp = self.findValueWithOffer(offer); 
      if (self.temp){
        for(issue in offer){
          for (var i = 0; i< self.A.length; i++){
            if (self.A[i] == issue){
              self.A.splice(i, 1); 
              i--
            }
          }

          for (var i = 0; self.discuss.length <i; i++){
            if (self.discuss[i] == issue){
              self.discuss.splice(i, 1);
              i--;
            }
          }
          self.B[self.B.length] = {};
          self.B[self.B.length-1].name = issue;
          self.B[self.B.length-1].value = offer[issue];
          self.B_temp = clone(self.B);         
        }

        for(issue in self.B){
          for (var i = 0; i< self.A.length; i++){
            if (self.A[i] == issue){
              self.A.splice(i, 1); 
              i--
            }
          }
        }
   
        
        logs.writeJsonLogGame(self.gameid, self.status, "OPPONENT OFFER ACCEPTED! ", offer);
        logs.writeJsonLogGame(self.gameid, self.status, "current agreement: ", self.B);
        logs.writeJsonLogGame(self.gameid, self.status, "left to agree on: ", self.A);
        
        var offerWithAccept = self.pickBid(self.turn);
        var bobj = convertBToObject(self.B)
        self.socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: bobj, role: self.role});
        if (offerWithAccept){
          if (offerWithAccept != "done"){
            return ([{"Accept" : offer}, {'StartNewIssue': offerWithAccept[self.gole]}, {"Offer" : offerWithAccept}]);
          }
          else{
            return ([{"Accept" : offer}, {"currentAgreement": bobj}]);
          }
        }
        else{
           return ([{"Accept" : offer}, {"currentAgreement": bobj}]);
        }
      }
      else{
        var tempb = clone(self.B);  //keep the B copy
        var tempa = clone(self.A);  //keep the A copy
        self.B_temp = clone(self.B);
        //keep the value we take out of our agreement to turn them back to black in the menue
        var backToBlack = {};
        var theOriginalOffer = clone(offer);
        
        logs.writeJsonLogGame(self.gameid, self.status, "couldn't find an acceptable bid with the current term ", self.B);
        logs.writeJsonLogGame(self.gameid, self.status, "and ", offer);
      
        self.recalculateSearchCluster(self.turn);
        for (issue in theOriginalOffer){
          self.removeFromSearchCluster(theOriginalOffer[issue]);
        }
        self.temp = self.findValueWithOffer();
        if (self.temp){

          self.B_temp = clone(self.B);
          var goleR = {}
          for(issue in theOriginalOffer){ //if the issue that the opponent offer exsist in A delete it from there
           //add the offer to B_temp
            goleR[issue] = self.temp.bid[issue];
            self.B_temp[self.B_temp.length] = {};
            self.B_temp[self.B_temp.length-1].name = issue;
            self.B_temp[self.B_temp.length-1].value = self.temp.bid[issue];
            for(var i = 0; i < self.discuss.length; i++){
              if(self.discuss[i].name == issue){
                if (self.discuss[i].lastOffer != goleR[issue])
                  self.discuss[i].lastOffer = goleR[issue]
              }
            }
            for (i in backToBlack)
              if (i == issue)
                delete backToBlack[i];
          }
            
          // add the gole that we set lower to B
          logs.writeJsonLogGame(self.gameid, self.status, "find another acceptable bid with the current term ", self.temp);
          logs.writeJsonLogGame(self.gameid, self.status, "OPPONENT OFFER DENIED OFFERING SOMETHING ELSE! ", self.B_temp);

          self.B = clone(tempb);

          logs.writeJsonLogGame(self.gameid, self.status, "the agent new offer: ", goleR);
          return ([{"Reject" : theOriginalOffer}, {"Offer" : goleR}] );
        }
        else{
          // if the agent can not find an offer with the B rerm and the opponent offer he recalculate the search cluster
          while(self.B.length > 0 && !self.temp){

            logs.writeJsonLogGame(self.gameid, self.status, "couldn't find an acceptable bid with the current term set the offer lower", self.B);
            logs.writeJsonLogGame(self.gameid, self.status, "and ", offer);
            self.gole = self.B[self.B.length-1].name;
            
            backToBlack[self.B[self.B.length-1].name] = null;
            var remove = self.B[self.B.length-1].value;
            //put the last value they agreed on from B, remove all the offers with that value from the search cluster and pop it from B.
            self.B.pop();
            self.removeFromSearchCluster(remove);
            //looking for the offer with the current term in B
            self.temp = self.findValueWithOffer(offer);
            if (self.temp){ //if it find a value with the current term
              self.B_temp = clone(self.B);
              for(issue in offer){ //if the issue that the opponent offer exsist in A delete it from there
                for (var i = 0; i< tempa.length; i++){
                  if (tempa[i] == issue){
                    tempa.splice(i, 1);
                    i--;
                  }
                } //add the offer to B_temp
                self.B_temp[self.B_temp.length] = {};
                self.B_temp[self.B_temp.length-1].name = issue;
                self.B_temp[self.B_temp.length-1].value = offer[issue];
              }
            
              var goleR = offer;
              goleR[self.gole] = self.temp.bid[self.gole];

              for(var i = 0; i < self.discuss.length; i++){
                if(self.discuss[i].name == self.gole){
                  if (self.discuss[i].lastOffer != goleR[self.gole])
                    self.discuss[i].lastOffer = goleR[self.gole]
                }
              }

              // add the gole that we set lower to B
              self.B_temp[self.B_temp.length] = {};
              self.B_temp[self.B_temp.length-1].name = self.gole;
              self.B_temp[self.B_temp.length-1].value = self.temp.bid[self.gole];
              var offerToAccept = clone(self.B_temp);

              //this.socket.emit('message', 'Can I propose the following counter-offer?');
              logs.writeJsonLogGame(self.gameid, self.status, "find an acceptable bid with the current term ", self.temp);
              logs.writeJsonLogGame(self.gameid, self.status, "OPPONENT OFFER DENIED OFFERING SOMETHING ELSE! ", self.B_temp);
             
              for (i in backToBlack)
                if (i == self.gole)
                  delete backToBlack[i];
              this.socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: backToBlack, role: this.role});  
              self.B = clone(tempb);

              logs.writeJsonLogGame(self.gameid, self.status, "the agent is workoing ", self.temp);
              console.log("the agent is workoing");
              for(var i = 0; i< offerToAccept.length; i++){
                for(issue in theOriginalOffer){
                  //otherBidOption[issue] = lastBid[issue]
                  if (offerToAccept[i].name == issue){
                    offerToAccept.splice(i,1);
                    i--;
                  }

                }
              }
             logs.writeJsonLogGame(self.gameid, self.status, "the agent is still workoing ", self.temp);
             console.log("the agent is still workoing");
              logs.writeJsonLogGame(self.gameid, self.status, "the 'accept' part ", offer);
              logs.writeJsonLogGame(self.gameid, self.status, "the 'offer' part ", offerToAccept);
              
              return ([{"Accept" : theOriginalOffer}, {'ChangeIssue': "previous"}, {"Offer" : convertBToObject(offerToAccept)}]);
            }
          // if there isn't any offer of the current term of B and the opponent offer push the gole to A and keep looking.
          }
         
          //if there is no way the agent agreed to an offer, he put back B to what it wes and reject the offer.
          if (self.B.length == 0 && !self.temp){
            var isInA = false;
            for (var i=0; i < tempa.length; i++){
              if (tempa == self.gole)
                isInA = true;
            }
            if(!isInA)
              tempa.push(self.gole);
            
            logs.writeJsonLogGame(self.gameid, self.status, "OPPONENT OFFER DENIED! ", offer);
            self.B = clone(tempb);
            self.B_temp = clone(tempb);
            self.A = clone(tempa);
            return ([{"Reject" : offer}]);
          }
        }
      }
    }
  },

  opponentRejected: function (offer, turn){
    var self = this;
    var curr = 0;  
    var prevTypeProbability = 0;
    var prevOfferValue = 0;
    var offerValue = 0;
    var updatedTypeProbability = 0;
    var offerSumAll = 0;
    var offerSunAgent = 0;

    if (typeof(offer) != "object"){
      var tempOffer = {};
      var exist = false;
      for(var i=0; i<self.B.length; i++){
        if (self.B[i].name == offer){
          exist = true;
          tempOffer[offer] = self.B[i].value;
          self.B.splice(i, 1);
          continue;
        }
      }
      if (!exist){
        for(var i=0; i<self.B_temp.length; i++){
          if (self.B_temp[i].name == offer){
            exist = true;
            tempOffer[offer] = self.B_temp[i].value;
            self.B.splice(i, 1);
            continue;
          }
        }
      }
      if( !exist){
        self.socket.emit('message', "What do you reject?");
        return;
      }
      if (!self.A.hasOwnProperty(offer)){ 
        self.A.push(offer);  
        }  
      self.gole = offer;
      offer = tempOffer;
    }

    for (var i = 0; i < self.posibleOpponent.length; i++){ 
      var name = self.posibleOpponent[i].nikName; //the nik name of current opponent
      prevTypeProbability = self.posibleOpponent[i].probability;
      var ut = self['oppUtility'+name].getUtility(offer);
      prevOfferValue = self['oppUtility'+name].getUtilityWithDiscount(ut, turn); //calculate the utility with discount.
      offerSumAll += self.calcRejectionProbabilities(name, prevOfferValue, prevTypeProbability);
    } 

    for (var i = 0; i < self.posibleOpponent.length; i++){
      var name = self.posibleOpponent[i].nikName; //the nik name of current opponent
      prevTypeProbability = self.posibleOpponent[i].probability;
      var ut = self['oppUtility'+name].getUtility(offer);
      prevOfferValue = self['oppUtility'+name].getUtilityWithDiscount(ut, turn); //calculate the utility with discount.
      offerSunAgent = self.calcRejectionProbabilities(name, prevOfferValue, prevTypeProbability);

      updatedTypeProbability = (offerSunAgent * prevTypeProbability) / offerSumAll;
      self.posibleOpponent[i].probability =  updatedTypeProbability;//the new probability
    }
    self.currOpponent  = 0;
    for (var i = 0; i < self.posibleOpponent.length; i++){
      if (self.posibleOpponent[i].probability > self.posibleOpponent[self.currOpponent].probability){
        self.currOpponent = i;
        self.nik = self.posibleOpponent[i].nikName;
      }
    }

    //all above is calculation of the opponent - here is what should bw done for that NegoChatAgent:
    if(!self.oppReaction) {
        self.oppReaction = true;
        for(var i =0; i<self.B_temp.length;i++){
          var isInTemp = false;
          for (issue in offer){
            if (self.B_temp[i].name == issue){
              isInTemp = true;
            }
          }
          if(!isInTemp){
            for (var j = 0 ;j< self.A.length;j++){
              if(self.B_temp[i].name == self.A[i]){
                self.A.splice(i, 1);
              }
            }
            self.B[self.B.length] = {}
            self.B[self.B.length-1].name = self.B_temp[i].name;
            self.B[self.B.length-1].value = self.B_temp[i].value;
          }
        }
      }
   

    var keyOffer = Object.keys(offer);
    if (keyOffer > 0){
      self.gole = keyOffer[0];
    }

    for (var i = 0; i < self.issueLength.length; i++) {
        var checkIfDone = false;
        for (var j =  0 ; j< self.B.length ;j++) {
          if(self.B[j].name == self.issueLength[i])
            checkIfDone = true;
        };
        if (!checkIfDone){
          self.A.push(self.issueLength[i])
          
          continue;
        }
      }
    self.removeFromSearchCluster(offer[self.gole]);// remove the current gole which the opponent rejected
    logs.writeJsonLogGame(self.gameid, self.status, "the opponent REJECT THIS OFFER ", offer);

    self.temp = self.findValue();  //try to find a bid without the gole the opponent reject               
    if (self.temp){
      self.socket.emit('enterAgentBidToMapRoleToMapIssueToValue', {bid: self.temp.bid, role: self.role});
      var exist = false;
      for (var i = 0; i<self.B_temp.length; i++){
        if (self.B_temp[i].name == self.gole){
          exist = true;
          self.B_temp[i].value = self.temp.bid[self.gole];
        }
        
      }
      if (!exist){
        self.B_temp[self.B_temp.length] = {}
        self.B_temp[self.B_temp.length-1].name = self.gole;
        self.B_temp[self.B_temp.length-1].value = self.temp.bid[self.gole];
      }

      var goleR = {}

      goleR[self.gole] = self.temp.bid[self.gole];
      logs.writeJsonLogGame(self.gameid, self.status, "the opponent rejected my offer and the agent's new offer is ", goleR);

      for(var i = 0; i < self.discuss.length; i++){
        if(self.discuss[i].name == self.gole){
          if (self.discuss[i].lastOffer != goleR[self.gole])
            self.discuss[i].lastOffer = goleR[self.gole]
        }
      }
      return ([{'Offer' :goleR}]);
    }
    else{
      var tempb = clone(self.B);  //keep the B copy
      var tempa = clone(self.A);  //keep the A copy
      //keep the value we take out of our agreement to turn them back to black in the menue
      var backToBlack = {};
      self.recalculateSearchCluster(self.turn);
      self.removeFromSearchCluster(offer[self.gole]);
      var otherGole = self.gole;
      while (self.B.length > 0 && !self.temp){
        logs.writeJsonLogGame(self.gameid, self.status, "couldn't find an acceptable bid with the current term ", self.B);
        logs.writeJsonLogGame(self.gameid, self.status, "AND WITH THE VALUE THAT THE OPPONENT REJECT! ", self.gole);
        
        var isGoleInA = false;
        for (var i = 0; i <self.A.length; i ++){
          if (self.A[i] == self.gole)
            isGoleInA = true;
        }
        if (!isGoleInA){
          self.A.push(self.gole);
        }
       
        self.gole = self.B[self.B.length-1].name;

        self.removeFromSearchCluster(self.B[self.B.length-1].value);
        backToBlack[self.B[self.B.length-1].name] = null;
        self.B.pop();
        self.B_temp = clone(self.B);
        self.temp = self.findValue();
        
        if (self.temp){//if it find a value with the current term add the offer to B
          
          self.B = clone(tempb);
          var inserted = false;
          for (var i = 0; i<self.B_temp.length; i++){
            if (self.B_temp[i].name == self.gole){
              self.B_temp[i].value = self.temp.bid[self.gole];
              inserted = true;
            }
          }
          for(var i = 0; i < self.discuss.length; i++){
            if(self.discuss[i].name == self.gole){
              if (self.discuss[i].lastOffer != self.temp.bid[self.gole])
                self.discuss[i].lastOffer = self.temp.bid[self.gole]
            }
          }
          if (!inserted){
            self.B_temp[self.B_temp.length] = {};
            self.B_temp[self.B_temp.length-1].name = self.gole;
            self.B_temp[self.B_temp.length-1].value = self.temp.bid[self.gole];
          }
          var optional = {};
          optional[otherGole] = self.temp.bid[otherGole];
           
          for (i in backToBlack)
            if (i == self.gole)
              delete backToBlack[i];

          var goleR = convertBToObject(self.B_temp)
          self.B_temp[self.B_temp.length] = {};
          self.B_temp[self.B_temp.length-1].name = self.otherGole;
          self.B_temp[self.B_temp.length-1].value = self.temp.bid[self.otherGole];

          logs.writeJsonLogGame(self.gameid, self.status, "find an acceptable bid with the current term ", self.B);
          logs.writeJsonLogGame(self.gameid, self.status, "AGENT OFFER SOMETHING ELSE!", self.B_temp);

          return ([{"Offer" : optional}, {'ChangeIssue': "previous"}, {"Offer" : goleR}] );

        }
        else{ 
        // if there is any offer of the current term of B and the opponent offer 
        //push the gole to A and keep looking.
            var isInA = false;
            for (var i=0; i < self.A.length; i++){
              if (self.A == self.gole)
                isInA = true;
            }
            if(!isInA)
              self.A.push(self.gole);
        }
      }
      if (self.B.length == 0 && !self.temp){
        self.A = clone(tempa);
        self.B = clone(tempb);
        self.B_temp = clone(tempb);
        self.socket.emit('message', "Just a minute, I need to think a bit.");
        return;
      }
    }
  },

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

function convertBToObject(temp){
  var tb = {};
  for (var i = 0; i<temp.length; i++){
    tb[temp[i].name] = temp[i].value;

  }
  return tb;

}

function doubleBid(offer){
  var isDouble = false;
  for (issue in offer){
    if (typeof(offer[issue]) == "object")
      isDouble = true;
  }
  return isDouble;
}

function readAspirationFile (){

  var some = new Object();
  var f = true;
  var j;
  var lines = fs.readFileSync('./domains/JobCandiate/aspiration.xml', 'utf8');
  //var lines = fs.readFileSync('./domains/israel/Kitchen/aspiration.xml', 'utf8');
  lines = lines.split(nl);
  return (lines);
}


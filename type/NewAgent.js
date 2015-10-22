module.exports = NewAgent;

var fs = require('fs');
var nl = require('os').EOL;
var logs = require('../logs');
var util = require('util');
var Analysis = require('../analysis/analysis');
var UtilitySpace = require('../analysis/utilitySpace');
var logger = require('../logger')
var OpponentData = require('../analysis/opponentData');
var PRECISION_VALUE = 0.3  // used in order to scale utilities and make them positive
var MIN_OFFERS_IN_SEARCH_CLUSTER = 0;


function NewAgent(domain, role, oppRole, gameid,country) {
  
  this.posibleOpponent = new Array();
  console.log(domain.agentsByOwnerAndPersonality)
  console.log(domain.agentsByOwnerAndPersonality[role.toLowerCase()])

  this.myUtilityShort = new UtilitySpace(domain.agentsByOwnerAndPersonality[role.toLowerCase()]['short-term'].utility_space_object);
  this.oppUtilityShort = new UtilitySpace(domain.agentsByOwnerAndPersonality[oppRole.toLowerCase()]['short-term'].utility_space_object);
  this.oppUtilityComp = new UtilitySpace(domain.agentsByOwnerAndPersonality[oppRole.toLowerCase()]['comp-romise'].utility_space_object);
  this.oppUtilityLong = new UtilitySpace(domain.agentsByOwnerAndPersonality[oppRole.toLowerCase()]['long-term'].utility_space_object);
  this.domain = domain;
  this.oppRole = oppRole;
  this.role = role;
  this.numOfBids = 0;
  this.issuesLength; //the issues' number.
  this.currOpponent = 0;// the number of the opponennt type 
  this.nik; //the nikname of the current opponent type.
  this.country = country;
  this.gameid = gameid;

  this.searchCluster;
  this.constForThreshold = 200; //range of the utility between the agent' threshold and the human threshold.

  this.A = readAspirationFile();
  this.B = [];
  this.B_temp = [];
  this.B_Rely;
}

NewAgent.prototype = {
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
    var bids = new Object();
    while (analysis.hasNext()){
      this.numOfBids++;
      bids[this.numOfBids] = {};
      var bid = analysis.next();
      bids[this.numOfBids].bid = bid;//JSON.stringify(bid);
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
    this.myUtilityShort.AvrageValuesPerIssue = this.agentStuff.AvrageValuesPerIssue;
  },

  initializeNewAgent: function (){
    var self = this;
    if (self.role == 'Employer'){
      self.posibleOpponent.push(new OpponentData('A', 'ShortTerm', 'Short', self.country));
      self.posibleOpponent.push(new OpponentData('A', 'Compromise', 'Comp', self.country));
      self.posibleOpponent.push(new OpponentData('A', 'LongTerm', 'Long', self.country));
      self.agentStuff = new OpponentData('B', 'ShortTerm', 'Short', self.country);
    }
    else {
      self.posibleOpponent.push(new OpponentData('B', 'ShortTerm', 'Short', self.country));
      self.posibleOpponent.push(new OpponentData('B', 'Compromise', 'Comp', self.country));
      self.posibleOpponent.push(new OpponentData('B', 'LongTerm', 'Long', self.country));
      self.agentStuff = new OpponentData('A', 'ShortTerm', 'Short', self.country);
    }

    self.currOpponent = Math.round(Math.random() * 2);
    self.nik = self.posibleOpponent[self.currOpponent].nikName;
    for (var i = 0; i < self.posibleOpponent.length; i++){
      self.posibleOpponent[i].probability = 1/self.posibleOpponent.length;
      self.posibleOpponent[i].calcProbability = 1/self.posibleOpponent.length;
    }
  },

  pickFirstBid: function (turn){ 
  //use this function to pick the first bid of the agent.
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
      self.B_Rely = self.temp.bid;
      return self.temp.bid;
    }
  },


  pickBid: function (turn){
  //use this function to pick the next bid to offer according to the A stuck
    var self = this;
    var bOver = convertBToObject(self.B);
    self.B_temp = clone(self.B); // when I suggest an offer I put into temp_b = B, so if the opp did not say anything and i should offer the same thing again, the offer will not appear twice in temp_b.
    self.turn = turn;
    if(self.B.length == self.issuesLength){
      self.B_Rely = bOver;
      return "done";
    }
    else{
      self.temp = self.findValue();
      if (self.temp){
        for (var i=0;i<self.A.length;i++){
          var exsist = false;
          for (var j=0;j<self.B_temp.length;j++){
            if(self.B_temp[j].name == self.A[i]){
              exsist = true;
              continue;
            }
          }
          if(!exsist){
            self.B_temp[self.B_temp.length] = {};
            console.dir(self.B_temp);
            self.B_temp[self.B_temp.length-1].name = self.A[i];
            self.B_temp[self.B_temp.length-1].value = self.temp.bid[self.A[i]];
          }
        }
        logs.writeJsonLogGame(self.gameid, self.status, "they agreed on ", self.B);
        logs.writeJsonLogGame(self.gameid, self.status, "the agent's offer is ", self.B_temp);
        logs.writeJsonLogGame(self.gameid, self.status, " BASED ON THAT BID (line 136) ", self.temp);
        logs.writeJsonLogGame(self.gameid, self.status, "============================ ", "");
        self.B_Rely = self.temp.bid;
        return (self.temp.bid);
      }
      else{//we have discuss everything and can sign the agreement
        return;
      }
    }
  },

  findMyNextIssueToTalk: function (){
    var self = this;
    var a = clone(self.A);
    for (var j = 0; j < self.B.length; j++){
      for (var i =0; i< a.length; i++){
        if(a[i] == self.B[j].name){
          a.splice(i, 1);
          i--;
          continue;
        }
      }
    }
    if(a.length>0)
      return a[0];
    else
      return;
  },

  opponentAccepted: function (offer, turn){
    var self = this;
    var num = 0;
    for (issue in offer){
      num++;
    }
    if(num == self.issuesLength){
      return "done";
    }
    else{
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
      logs.writeJsonLogGame(self.gameid, self.status, "the opponent agreed on the agent's offer ", offer);
      logs.writeJsonLogGame(self.gameid, self.status, "the current agreement is: ", self.B);
      logs.writeJsonLogGame(self.gameid, self.status, "BASED ON THAT BID (line 219) ", self.temp);
      logs.writeJsonLogGame(self.gameid, self.status, "============================ ", "");
    
      var offerWithAccept =self.pickBid(self.turn); //try to find the next issue to discuss on.
      if (offerWithAccept){
        if(offerWithAccept == "done")
          return offerWithAccept;
        else{
          self.gole = self.findMyNextIssueToTalk();
          var sendOffer = {};
          sendOffer[self.gole] = offerWithAccept[self.gole];
          return ([{"Offer" : sendOffer}]);
        }
      }
    }
   
  //if the opponent accept the agent's offer
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
            self.B_temp.splice(i, 1);
            continue;
          }
        }
      }
      if(!exist){
        return;
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
    
    var keyOffer = Object.keys(offer);
      if (keyOffer.length > 0){
        self.gole = keyOffer[0];
      }
    if(!self.gole)
      self.gole = self.findMyNextIssueToTalk();
    self.removeFromSearchCluster(offer[self.gole]);// remove the current gole which the opponent rejected
    logs.writeJsonLogGame(self.gameid, self.status, "the opponent REJECT THIS OFFER ", offer);

    self.temp = self.findValue();  //try to find a bid without the gole the opponent reject               
    if (self.temp){
      self.B_Rely = self.temp.bid;
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
      logs.writeJsonLogGame(self.gameid, self.status, "BASED ON THAT BID (line 321) ", self.temp);
      logs.writeJsonLogGame(self.gameid, self.status, "============================ ", "");

      return ([{'Offer' :goleR}]);
    }
    else{
      var tempb = clone(self.B);  //keep the B copy
      //keep the value we take out of our agreement to turn them back to black in the menue
      self.recalculateSearchCluster(self.turn);
      self.removeFromSearchCluster(offer[self.gole]);
      var otherGole = self.gole;
      self.temp = self.retreat(offer,false);

      if (self.temp){//if it find a value with the current term add the offer to B
        self.B_Rely = self.temp.bid;
        self.insertAcceptedOfferWithGole(tempb);
        var optional = {};
        optional[otherGole] = self.temp.bid[otherGole];

        var goleR = convertBToObject(self.B_temp)
        self.B_temp[self.B_temp.length] = {};
        self.B_temp[self.B_temp.length-1].name = self.otherGole;
        self.B_temp[self.B_temp.length-1].value = self.temp.bid[self.otherGole];
        logs.writeJsonLogGame(self.gameid, self.status, "find an acceptable bid with the current term ", self.B);
        logs.writeJsonLogGame(self.gameid, self.status, "AGENT OFFER SOMETHING ELSE!", self.B_temp);
        logs.writeJsonLogGame(self.gameid, self.status, "BASED ON THAT BID (line 346) ", self.temp);
        logs.writeJsonLogGame(self.gameid, self.status, "============================ ", "");

        return ([{"Offer" : optional}, {'ChangeIssue': "previous"}, {"Offer" : goleR}] );
      }
      if (self.B.length == 0 && !self.temp){
        self.B = clone(tempb);
        self.B_temp = clone(tempb);
        return;
      }
    }
  },


  checkBid: function (offer, turn){
    var self = this;
    var tempOffer = offer;
    var len = 0;
    for (var o in offer) {
        len++;
    }
    logs.writeJsonLogGame(self.gameid, self.status, "the opp offer : ",offer);
    if (len ==  self.issuesLength) {// check if the bid is full.
      // find the number of the current bid.
      var bidNum = self.findCurrBid(offer);
      var currUtil = self.initBids[bidNum]['utilOpp'+self.nik]
      self.checkOpponent(turn, offer);

      var currUtil = self['oppUtility'+self.nik].getUtilityWithDiscount(self.initBids[bidNum]['utilOpp'+self.nik], turn);
      var myUtility = self['myUtilityShort'].getUtilityWithDiscount(self.initBids[bidNum]['utilMe'], turn);

      if(myUtility >= this.posibleOpponent[this.currOpponent].agentAcceptThersholds[turn]){
          self.B_Rely = tempOffer;
          console.log("here1")
          return ({"Accept" : tempOffer});
        }
      else
          return ({"Reject" : tempOffer});
    }
    else{      
      //make the offer to be full for get the utility
      logs.writeJsonLogGame(self.gameid, self.status, "offer in the search cluster: ", self.searchCluster.length);
      //if there is a dubble offer like 8 or 9 hours pick the best for the agent.
      if (doubleBid(offer)){
        offer = self.pikBestOffer(offer);
      }
      //if the offer was negotiate before teke it out from B and B_temp.
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
      // when the opponent offer something, the agent looking for an acceptable bid 
      //in the search cluster.
      if(self.searchCluster.length < MIN_OFFERS_IN_SEARCH_CLUSTER){
        logs.writeJsonLogGame(self.gameid, self.status, "offer in the search cluster: ", self.searchCluster.length);
        self.recalculateSearchCluster(self.turn);
        logs.writeJsonLogGame(self.gameid, self.status, "offer in the search cluster: ", self.searchCluster.length);
      }
      self.temp = self.findValueWithOffer(offer); 
      if (self.temp){
        //enter the player offer to stuck B.
        for(issue in offer){
          self.B[self.B.length] = {};
          self.B[self.B.length-1].name = issue;
          self.B[self.B.length-1].value = offer[issue];
          self.B_temp = clone(self.B);         
        }
        logs.writeJsonLogGame(self.gameid, self.status, "offer in the search cluster: ", self.searchCluster.length);
        logs.writeJsonLogGame(self.gameid, self.status, "OPPONENT OFFER ACCEPTED! ", offer);
        logs.writeJsonLogGame(self.gameid, self.status, "current agreement: ", self.B);
        logs.writeJsonLogGame(self.gameid, self.status, "BASED ON THAT BID (line 427) ", self.temp);
        self.B_Rely = clone(self.temp.bid);
        var offerWithAccept = self.pickBid(self.turn);//try to find the next issue to discuss on.
        var bobj = convertBToObject(self.B)
        if (offerWithAccept != "done"){
          if (offerWithAccept){
            self.gole = self.findMyNextIssueToTalk();
            var sendOffer = {};
            sendOffer[self.gole] = offerWithAccept[self.gole];
            console.log("here2")
            return ([{"Accept" : offer}, {'StartNewIssue': offerWithAccept[self.gole]}, {"Offer" : sendOffer}]);
          }
          else{
            console.log("here3")
            return ([{"Accept" : offer}, {"currentAgreement": bobj}]);
          }
        }
        else{
            console.log("here4")
           return ([{"Accept" : offer}, {"currentAgreement": bobj}]);
        }
      }
      else{ //if the agent did not find an acceptabl bid in the search cluster he try to retrive othe issues to accept the offer.
        var tempSearchCluster = clone(self.searchCluster);
        var tempb = clone(self.B);  //keep the B copy

        self.B_temp = clone(self.B);
        //keep the value we take out of our agreement to turn them back to black in the menue
        var backToBlack = {};
        var theOriginalOffer = clone(offer);
        logs.writeJsonLogGame(self.gameid, self.status, "offer in the search cluster: ", self.searchCluster.length);
        logs.writeJsonLogGame(self.gameid, self.status, "couldn't find an acceptable bid with the current term ", self.B);
        logs.writeJsonLogGame(self.gameid, self.status, "and ", offer);
      
        self.recalculateSearchCluster(self.turn);
        for (issue in theOriginalOffer){
          self.removeFromSearchCluster(theOriginalOffer[issue]);
        }
        self.temp = self.findValue();
        if (self.temp){
          self.B_Rely = self.temp.bid;
          var goleR = {}
          for(issue in theOriginalOffer){ //if the issue that the opponent offer exsist in A delete it from there
           //add the offer to B_temp
            goleR[issue] = self.temp.bid[issue];
            self.B_temp[self.B_temp.length] = {};
            self.B_temp[self.B_temp.length-1].name = issue;
            self.B_temp[self.B_temp.length-1].value = self.temp.bid[issue];
          }
          logs.writeJsonLogGame(self.gameid, self.status, "offer in the search cluster: ", self.searchCluster.length);
          logs.writeJsonLogGame(self.gameid, self.status, "find another acceptable bid with the current term ", self.temp);
          logs.writeJsonLogGame(self.gameid, self.status, "OPPONENT OFFER DENIED OFFERING SOMETHING ELSE! ", self.B_temp);
          logs.writeJsonLogGame(self.gameid, self.status, "the agent new offer: ", goleR);
          logs.writeJsonLogGame(self.gameid, self.status, "BASED ON THAT BID (line 476) ", self.temp);
          logs.writeJsonLogGame(self.gameid, self.status, "============================ ", "");
          
          self.B = clone(tempb);
          self.searchCluster = clone(tempSearchCluster);
          console.log("This is where agent reject the entire offer")
          console.log(JSON.stringify(theOriginalOffer, null, 4))
          // return ([{"Reject" : theOriginalOffer}, {"Offer" : goleR}] );
          return ([{"Reject" : true}, {"Offer" : goleR}] );
        }
        else{
          // if the agent can not find an offer with the B term and the opponent offer
          self.temp = self.retreat(offer,true);
          if (self.temp){ //if it find a value with the current term
            self.B_Rely = self.temp.bid;
            self.insertAcceptedOfferWithGole(tempb,offer);
            var offerToAccept = clone(self.B_temp);
            
            for(var i = 0; i< offerToAccept.length; i++){
              for(issue in theOriginalOffer){
                if (offerToAccept[i].name == issue){
                  offerToAccept.splice(i,1);
                  i--;
                }
              }
            }
            logs.writeJsonLogGame(self.gameid, self.status, "offer in the search cluster: ", self.searchCluster.length);
            logs.writeJsonLogGame(self.gameid, self.status, "the 'accept' part ", offer);
            logs.writeJsonLogGame(self.gameid, self.status, "the 'offer' part ", offerToAccept);
            logs.writeJsonLogGame(self.gameid, self.status, "BASED ON THAT BID (line 501) ", self.temp);
            self.searchCluster = clone(tempSearchCluster);  
            console.log("here9")
            return ([{"Accept" : theOriginalOffer}, {'ChangeIssue': "previous"}, {"Offer" : convertBToObject(offerToAccept)}]);
          }
        }
        //if there is no way the agent agreed to an offer, he put back B to what it wes and reject the offer.
        if (self.B.length == 0 && !self.temp){
          logs.writeJsonLogGame(self.gameid, self.status, "offer in the search cluster: ", self.searchCluster.length);
          logs.writeJsonLogGame(self.gameid, self.status, "OPPONENT OFFER DENIED! ", offer);
          logs.writeJsonLogGame(self.gameid, self.status, "BASED ON THAT BID (line 510) ", self.temp);
          self.B = clone(tempb);
          self.B_temp = clone(tempb);
          self.searchCluster = clone(tempSearchCluster);
          return ([{"Reject" : offer}]);
        }
      }
    }
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
          if (typeof(offer[issue]) == "object"){
            if ((offer[issue][0]).toLowerCase() != (this.initBids[i].bid[issue]).toLowerCase())
              checkEachBid = false;
          }
          else{
            if ((offer[issue]).toLowerCase() != (this.initBids[i].bid[issue]).toLowerCase())
              checkEachBid = false;
          }
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
        sumProbabilities += prevOfferProbability * prevTypeProbability; // self.posibleOpponent[i].calculateCurrOpp(luc); // add the numerator of the calculation of the probability
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

  retreat: function (offer, rejected){
    var self = this;
    while(self.B.length != 0 && !self.temp){
      self.gole = self.B[self.B.length-1].name;
      //put the last value they agreed on from B, remove all the offers with that value from the search cluster and pop it from B.
      self.removeFromSearchCluster(self.B[self.B.length-1].value);
      self.B.pop();
      //looking for the offer with the current term in B
      logs.writeJsonLogGame(self.gameid, self.status, "couldn't find an acceptable bid with the current term set the offer lower", self.B);
      logs.writeJsonLogGame(self.gameid, self.status, "and ", offer);
      if(rejected){
        self.temp = self.findValueWithOffer(offer);
        
      }
      else{
        self.temp = self.findValue();
      }
    }
    if(self.temp)
      return self.temp;
    else
      return;
  },

  insertAcceptedOfferWithGole: function(tempb,offer){
    var self = this;
    self.B_temp = clone(self.B);
    self.B = clone(tempb);
    var inserted = false;
    for (var i = 0; i<self.B_temp.length; i++){
      if (self.B_temp[i].name == self.gole){
        self.B_temp[i].value = self.temp.bid[self.gole];
        inserted = true;
      }
    }
    if (!inserted){
      self.B_temp[self.B_temp.length] = {};
      self.B_temp[self.B_temp.length-1].name = self.gole;
      self.B_temp[self.B_temp.length-1].value = self.temp.bid[self.gole];
    }
    if(offer){
      var inB = false;
      for(issue in offer){//add the offer to B_temp
        for (var i = 0; i<self.B_temp.length; i++){
          if (self.B_temp[i].name == issue){
            self.B_temp[self.B_temp.length-1].value = offer[issue];
            inB = true;
          }
        }
        if(!inB){
          self.B_temp[self.B_temp.length] = {};
          self.B_temp[self.B_temp.length-1].name = issue;
          self.B_temp[self.B_temp.length-1].value = offer[issue];
        }
      }
    }
  },
  tryToCompromise: function(turn){
    var self = this;

    self.B_temp = clone(self.B);
    var tempb = clone(self.B);
    self.B = {};
    var bidNum = self.findCurrBid(self.B_Rely);
    var currUtil = self.initBids[bidNum].utilMe + (turn*self.myUtilityShort.timeeffect);
    self.temp = self.findValueMinMax(currUtil);  //try to find a bid               
    if (self.temp){
      for(offer in self.temp.bid){
        self.B_temp[self.B_temp.length] = {};
        self.B_temp[self.B_temp.length-1].name = offer;
        self.B_temp[self.B_temp.length-1].value = self.temp.bid[offer];
      }
      self.B = clone(tempb);
      self.B_Rely = self.temp.bid;
      var goleR = {}
      goleR[self.gole] = self.temp.bid[self.gole];
      self.B_Rely = self.temp.bid;
      logs.writeJsonLogGame(self.gameid, self.status, "the opponent want the agent to comromise and the agent's new offer is ", self.B_Rely);
      return (self.B_Rely);
      }
    else{
      self.B = clone(tempb);
      return;
    }
  },

  findValueMinMax: function (min){
    var self = this;
    var minUtility = min;
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
      if(self.searchCluster[bid].utilMe > maxUtility && flag && self.searchCluster[bid].utilMe < minUtility){
          maxUtility = self.searchCluster[bid].utilMe;
          currBid = self.searchCluster[bid];
      }
    }
    return currBid;
  },
  pickIssueForYou: function(turn){
  //when the user asks the agent "what the next issue to duscuss" 
  //he brings the next issue to discuss on   
    var self = this;
    var issueToTalk;
    for (var i=0;i<self.A.length;i++){
      var exsist = false;
      for (var j=0;j<self.B_temp.length;j++){
        if(self.B_temp[j].name == self.A[i]){
          exsist = true;
          continue;
        }
      }
      if(!exsist)
        issueToTalk = self.A[i];
    }
    if (!issueToTalk){
       var a_t = self.A[0];
       return('message', "pick an issue to talk about" );
    }
    else{
      return ("Let's talk about " + issueToTalk );
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

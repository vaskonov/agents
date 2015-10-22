

module.exports = KBAgent;

var util = require('util');
var Analysis = require('../analysis/analysis');
var UtilitySpace = require('../analysis/utilitySpace');
var logger = require('../logger')
var OpponentData = require('../analysis/opponentData');
var PRECISION_VALUE = 0.3  // used in order to scale utilities and make them positive
//new
var turnBeforOffer = 2 
var waitForOpponentFirstOffer = false;
var opponentRejectedMyLastOfferOrMadeCounterOffer = false;
var lastTurnOfOffer = -100; 

function KBAgent(domain, role, oppRole,gameid,country) {
  this.domain = domain;
  this.socket;
  this.role = role;
  this.numOfBids = 0;
  this.posibleOpponent = new Array();
  this.myUtilityShort = new UtilitySpace(domain.agentsByOwnerAndPersonality[role.toLowerCase()]['short-term'].utility_space_object);
  this.oppUtilityShort = new UtilitySpace(domain.agentsByOwnerAndPersonality[oppRole.toLowerCase()]['short-term'].utility_space_object);
  this.oppUtilityComp = new UtilitySpace(domain.agentsByOwnerAndPersonality[oppRole.toLowerCase()]['comp-romise'].utility_space_object);
  this.oppUtilityLong = new UtilitySpace(domain.agentsByOwnerAndPersonality[oppRole.toLowerCase()]['long-term'].utility_space_object);
  this.issuesLength; //the issues' number.
  this.currOpponent = 0;// the 
  this.nik; //the nikname of the current opponent type.
  this.partial = {};
  this.country = country;
 }

KBAgent.prototype = {

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
    this.myUtilityShort.AvrageValuesPerIssue = this.agentStuff.AvrageValuesPerIssue;
  },

  initializeKBAgent: function (){
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

  pickBid: function (turn){
      var self = this;
      if (!self.posibleOpponent){
        throw new Error ("possible opponent not define");
        console.dir(self);
      }
      if (!self.posibleOpponent[self.currOpponent]){
        throw new Error ("possible opponent["+self.currOpponent+"] not define");
        console.dir(self);
      }
      if (!self.posibleOpponent[self.currOpponent].agentOffers){
        throw new Error ("possible opponent["+self.currOpponent+"].agentOffers not define");
        console.dir(self);
      }

      if (self.posibleOpponent[self.currOpponent].lastOfferIndex < Object.keys(self.posibleOpponent[self.currOpponent].agentOffers).length){
        self.posibleOpponent[self.currOpponent].lastOfferIndex = self.posibleOpponent[self.currOpponent].lastOfferIndex + 1;
      }
      var index = (self.posibleOpponent[self.currOpponent].lastOfferIndex);
      var offerForTurn = self.posibleOpponent[self.currOpponent].agentOffers[index];
      if (!offerForTurn){
        index--;
        offerForTurn = self.posibleOpponent[self.currOpponent].agentOffers[index];
      }
      var numB = self.findCurrBid(offerForTurn);
    
      var currUtil = self['oppUtility'+self.nik].getUtilityWithDiscount(self.initBids[numB]['utilOpp'+self.nik], turn);
      var myUtility = self['myUtilityShort'].getUtilityWithDiscount(self.initBids[numB]['utilMe'], turn);
      return (self.initBids[numB].bid);
  },

  opponentAccepted: function (offer, turn){
    return;
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


  checkBid: function (offer, turn){
    var self = this;
    var tempOffer = offer;
    var len = 0;
    for (var o in offer) {
        len++;
    }

    if (len ==  self.issuesLength) {// check if the bid is full.
      // find the number of the current bid.
      var bidNum = self.findCurrBid(offer);
      var currUtil = self.initBids[bidNum]['utilOpp'+self.nik]
      self.checkOpponent(turn, offer);

      var currUtil = self['oppUtility'+self.nik].getUtilityWithDiscount(self.initBids[bidNum]['utilOpp'+self.nik], turn);
      var myUtility = self['myUtilityShort'].getUtilityWithDiscount(self.initBids[bidNum]['utilMe'], turn);
    }
    else{
       
      //make the offer to be full for get the utility
      var currUtil = self['oppUtility'+ self.nik].getUtility(offer);
      self.checkOpponent(turn, currUtil);
      util._extend(self.partial, offer);
      if (Object.keys(self.partial).length == self.issuesLength){
        var myUt = self.myUtilityShort.getUtility(self.partial);
        var myUtility = self['myUtilityShort'].getUtilityWithDiscount(myUt, turn);
        var offer = self.partial;
      }
      else{
        var myUt = self.myUtilityShort.getUtility(offer);
        var myUtility = self['myUtilityShort'].getUtilityWithDiscount(myUt, turn);
      }
    }

    if(myUtility >= this.posibleOpponent[this.currOpponent].agentAcceptThersholds[turn]) 
          return ({"Accept" : tempOffer});
      else
          return ({"Reject" : tempOffer});
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
}

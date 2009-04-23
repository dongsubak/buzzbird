/*
Copyright (c) 2009 Mike Desjardins

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
var username = "";
var password = "";
var mostRecentTweet = null;
var mostRecentDirect = null;
var parser = new DOMParser();

var classes = {
	"tweet" : {
		message: "tweetMessage",
		bottomRow: "tweetBottomRow",
		box: "tweetBox",
		text: "tweetText",
		table: "tweetTable",
		avatar: "tweetAvatar",
		avatarColumn: "tweetAvatarColumn",
		textColumn: "tweetTextColumn",
		screenName: "tweetScreenName",
		content: "tweetContent",
		info: "tweetInfo",
		icon: "tweetIcon"
	},
	"mine" : {
		message: "mineMessage",
		bottomRow: "mineBottomRow",
		box: "mineBox",
		text: "mineText",
		table: "mineTable",
		avatar: "mineAvatar",
		avatarColumn: "mineAvatarColumn",
		textColumn: "mineTextColumn",
		screenName: "mineScreenName",
		content: "mineContent",
		info: "mineInfo",
		icon: "mineIcon"
	},
	"reply" : {
		message: "replyMessage",
		bottomRow: "replyBottomRow",
		box: "replyBox",
		text: "replyText",
		table: "replyTable",
		avatar: "replyAvatar",
		avatarColumn: "replyAvatarColumn",
		textColumn: "replyTextColumn",
		screenName: "replyScreenName",
		content: "replyContent",
		info: "replyInfo",
		icon: "replyIcon"
	},
	"direct-to" : {
		message: "directToMessage",
		bottomRow: "directToBottomRow",
		box: "directToBox",
		text: "directToText",
		table: "directToTable",
		avatar: "directToAvatar",
		avatarColumn: "directToAvatarColumn",
		textColumn: "directToTextColumn",
		screenName: "directToScreenName",
		content: "directToContent",
		info: "directToInfo",
		icon: "directToIcon"
	},
	"direct-from" : {
		message: "directFromMessage",
		bottomRow: "directFromBottomRow",
		box: "directFromBox",
		text: "directFromText",
		table: "directFromTable",
		avatar: "directFromAvatar",
		avatarColumn: "directFromAvatarColumn",
		textColumn: "directFromTextColumn",
		screenName: "directFromScreenName",
		content: "directFromContent",
		info: "directFromInfo",
		icon: "directFromIcon"
	}
}

// Gets the login params and calls login to attempt authenticating
// with the twitter API.  Calls start() if successful.
//
function authenticate() {
	message("Authenticating");
	$('loginThrobber').style.display = 'inline';
	$('username').disabled = true;
	$('password').disabled = true;
	$('loginOkButton').disabled = true;
	
	username = $('username').value;
	password = $('password').value;
	
	if (login()) {
		getChromeElement('usernameLabelId').value = username;
		getChromeElement('passwordLabelId').value = password;
		registerEvents();
		getBrowser().loadURI("chrome://buzzbird/content/main.html",null,"UTF-8");
	} else {
		message("");
		$('badAuth').style.display = 'inline';
		$('loginThrobber').style.display = 'none';
		$('username').disabled = false;
		$('password').disabled = false;
		$('loginOkButton').disabled = false;
		$('password').select(); // this not working as well as I had hoped.  :(
		$('password').focus(); 
	}
}

// This function does the actual authentication request to the twitter API.  Called
// by the login function.
//
function login() {
	var req = new XMLHttpRequest();
	req.mozBackgroundRequest = true;
	req.open('GET','http://twitter.com/account/verify_credentials.json',false,username,password);
	req.send(null);
	if (req.status == 200) {
		var user = eval('(' + req.responseText + ')');
		var img = user.profile_image_url;
		getChromeElement('avatarLabelId').value = img;
		getChromeElement('realnameLabelId').value = user.name;
		getChromeElement('avatarId').src = img;
		return true;
	} else {
		return false;
	}
}

// Registers the events for this window
//
function registerEvents() {
	jsdump('register events')
	try {
		getMainWindow().document.addEventListener("fetchAll", fetchAll, false); 
		getMainWindow().document.addEventListener("start", start, false); 
	} catch(e) {
		jsdump('Problem initializing events: ' + e);
	}
}

// Called to initialize the main window from the browser's onload method.
//
function start() {
	// Update Frequency, need to make this configurable.
	var interval = getIntPref('buzzbird.update.interval',180000);
	jsdump('interval=' + interval);
	showingAllTweets = getChromeElement('showingAllTweetsId').value;
	showingReplies = getChromeElement('showingRepliesId').value;
	showingDirect = getChromeElement('showingDirectId').value;
	var updateTimer = getMainWindow().setInterval(fetch,interval);
	getChromeElement('updateTimerId').value = updateTimer;
	getChromeElement('toolbarid').collapsed=false;
	getChromeElement('textboxid').collapsed=false;
	getChromeElement('refreshButtonId').collapsed=false;
	getChromeElement('shortenUrlId').collapsed=false;
	getChromeElement('markAllAsReadId').collapsed=false;
	getChromeElement('symbolButtonId').collapsed=false;
	fetchAll();
}

// Enables/disables the refresh button.
//
function refreshAllowed(allowed) {
	if (allowed) {
		getChromeElement('refreshButtonId').disabled=false;
		getChromeElement('refreshButtonId').image='chrome://buzzbird/content/images/reload-button-active-20x20.png';		
	} else {
		getChromeElement('refreshButtonId').disabled=true;
		getChromeElement('refreshButtonId').image='chrome://buzzbird/content/images/reload-button-disabled-20x20.png';				
	}
}

// Writes a message to the statusbar.
//
function message(text) {
	getChromeElement('statusid').value = text;	
}

// Writes the length of the tweet entry field to the statusbar.
//
function updateLengthDisplay() {
	var textbox = getChromeElement('textboxid');
	var length = textbox.value.length;
	if (length != 0) {
		getChromeElement('statusid').value = length + '/140';
	} else {
		getChromeElement('statusid').value = '';
	}
}

// Toggles the progress meter.
//
function progress(throbbing) {
	var mainWindow = getMainWindow();
	if (throbbing) {
		getChromeElement('avatarId').src = 'chrome://buzzbird/content/images/ajax-loader.gif';
	} else {
		getChromeElement('avatarId').src = getChromeElement('avatarLabelId').value;
	}

}

// Returns 'tweet','reply','direct', or 'mine'
//
function tweetType(tweet) {
	var result = 'tweet'
	if (tweet.text.substring(0,11) == "Directly to") {
		result = 'direct-to';
	} else if (tweet.sender != undefined) {
		result = 'direct-from';
	} else if (tweet.in_reply_to_screen_name == getUsername()) {
		result = 'reply';
	} else if (tweet.user.screen_name == getUsername()) {
		result = 'mine';
	}
	return result;
}

// Update timestamp
//
function updateTimestamps() {
	var ONE_SECOND = 1000;
	var ONE_MINUTE = 60 * ONE_SECOND;
	var ONE_HOUR = 60 * ONE_MINUTE;
	var ONE_DAY = 24 * ONE_HOUR;
	
	jsdump('updating timestamps.');
	var timestamps = getBrowser().contentDocument.getElementsByName('timestamp');
	var now = new Date();
	for (var i=0; i<timestamps.length; i++) {
		tweetid = timestamps[i].id;
		when = $(tweetid).innerHTML;
		var then = new Date(parseFloat(when));
		var delta = now - then;
		var prettyWhen = "less than 1m ago";
		if (delta > ONE_MINUTE && delta < ONE_HOUR) {
			// between 1m and 59m, inclusive
			var prettyWhen = "about " + parseInt(delta/ONE_MINUTE) + "m ago"
		} else  if (delta >= ONE_HOUR && delta < ONE_DAY) {
			// less than 24h ago
			var prettyWhen = "about " + parseInt(delta/ONE_HOUR) + "h " + parseInt((delta%ONE_HOUR)/ONE_MINUTE) + "m ago"
		} else if (delta >= ONE_DAY) {
			var prettyWhen = "more than " + parseInt(delta/(ONE_DAY)) + "d ago";
		}
		var elid = 'prettytime-' + tweetid.substring(tweetid.indexOf('-')+1);
		$(elid).innerHTML = prettyWhen;
	}
	jsdump('finished updating timestamps.');

	// do it again a minute from now.
	//setTimeout(updateTimestamps(),ONE_MINUTE);
}

// Formats a tweet for display.
//
function formatTweet(tweet) {
	// Clean any junk out of the text.
	text = sanitize(tweet.text);
	
	// First, go through and replace links with real links.
	var re = new RegExp("http://(\\S*)", "g");
	var text = text.replace(re, "<a onmouseover=\"this.style.cursor='pointer';\" onclick=\"linkTo('http://$1');\">http://$1</a>");
	
	// Next, replace the twitter handles
	re = new RegExp("@(\\w*)", "g");
	text = text.replace(re, "@<a onmouseover=\"this.style.cursor='pointer';\" onclick=\"linkTo('http://twitter.com/$1');\">$1</a>");
	
	// Finally, replace the hashtags
	re = new RegExp("#(\\w*)", "g");
	text = text.replace(re, "#<a onmouseover=\"this.style.cursor='pointer';\" onclick=\"linkTo('http://hashtags.org/tag/$1');\">$1</a>");
	
	var when = new Date(tweet.created_at);
	var prettyWhen = when.toLocaleTimeString() + ' on ' + when.toLocaleDateString().substring(0,5);
	var user;
	if (tweetType(tweet) == 'direct-from') {
		user = tweet.sender;
	} else {
		user = tweet.user;
	}
	
	c = classes[tweetType(tweet)];

	// Figure out if we're displaying this flavor of tweet
	var currentFilter = getChromeElement('filterbuttonid').label;
	var showingAllTweets = getChromeElement('showingAllTweetsId').value;
	var showingReplies = getChromeElement('showingRepliesId').value;
	var showingDirect = getChromeElement('showingDirectId').value;
	
	var display = 'none';
	if (  (currentFilter == showingAllTweets) ||
          ((currentFilter == showingDirect) && (tweetType(tweet) == 'direct')) ||
          ((currentFilter == showingReplies && (tweetType(tweet) == 'reply')) ) ) {
	  display = 'inline';
    }
	
	var via = ""
	if (tweet.source != undefined && tweet.source != null && tweet.source != "") {
		via = " via " + tweet.source;
	} 

	var result = 
	   "<div id=\"raw-" + tweet.id + "\" style=\"display:none;\">" + sanitize(tweet.text) + "</div>"
     + "<div id=\"screenname-" + tweet.id + "\" style=\"display:none;\">" + sanitize(user.screen_name) + "</div>"
	 + "<div id=\"timestamp-" + tweet.id + "\" name=\"timestamp\" style=\"display:none;\">" + new Date(tweet.created_at).getTime() + "</div>"
     + "<div id=\"tweet-" + tweet.id + "\" class=\"tweetBox\" name=\"" + tweetType(tweet) + "\" style=\"display:" + display + "\" onmouseover=\"showIcons("+ tweet.id + ")\" onmouseout=\"showInfo(" + tweet.id + ")\">"
	 + " <div class=\"" + c.message + "\">"
	 + "  <table class=\"" + c.table + "\">"
	 + "   <tr>"
	 + "    <td valign=\"top\" class=\"" + c.avatarColumn + "\">"
	 + "     <a onmouseover=\"this.style.cursor='pointer';\" onclick=\"linkTo('http://twitter.com/" + sanitize(user.screen_name) + "');\" style=\"margin:0px;padding:0px\" title=\"View " + sanitize(user.screen_name) + "'s profile\">"
	 + "      <img src=\"" + user.profile_image_url + "\" class=\"" + c.avatar +"\" />"
     + "     </a>"
     + "    </td>"
     + "    <td>"
	 + "     <div class=\"" + c.text + "\">"
	 + "      <p><span class=\"" + c.screenName + "\">" + sanitize(user.screen_name) + "</span> <span class=\"" + c.content + "\">" + text + "</span></p>"
     + "     </div>"
     + "    </td>"
     + "   </tr>"
     + "  </table>"
     + "  <div class=\"" + c.bottomRow + "\">"
     + "   <img name=\"mark\" id=\"mark-" + tweet.id + "\" src=\"chrome://buzzbird/content/images/star-yellow.png\" style=\"width:16px; height:16px; vertical-align:middle;\""
     + "        onclick=\"toggleMarkAsRead(" + tweet.id + ");\" onmouseover=\"this.style.cursor='pointer';\" />"
     + "   <span id=\"tweetInfo-" + tweet.id + "\">"
     + "    <span class=\"" + c.info + "\">" 
     +       sanitize(user.name) + " <span id=\"prettytime-" + tweet.id + "\">less than 1m ago</span>"
     + "    </span>"
     + "   </span>"
     + "   <span id=\"tweetIcons-" + tweet.id + "\" style=\"display:none;\">"	        
     + "    <a class=\"" + c.info + "\" title=\"Retweet This\" onclick=\"retweet(" + tweet.id + ");\"><img src=\"chrome://buzzbird/content/images/recycle-grey-16x16.png\" class=\"" + c.icon + "\" /></a>"
     + "    <a class=\"" + c.info + "\" title=\"Reply to " + sanitize(user.screen_name) + "\" onclick=\"replyTo(" + tweet.id + ");\"><img src=\"chrome://buzzbird/content/images/reply-grey-16x16.png\" class=\"" + c.icon + "\" /></a>"
     + "    <a class=\"" + c.info + "\" title=\"Send a Direct Message to " + user.screen_name + "\" onclick=\"sendDirect(" + tweet.id + ");\"><img src=\"chrome://buzzbird/content/images/phone-grey-16x16.png\" class=\"" + c.icon + "\" /></a>"
     + "    <a class=\"" + c.info + "\" title=\"Mark as Favorite\" onclick=\"favorite(" + tweet.id + ");\"><img src=\"chrome://buzzbird/content/images/heart-grey-16x16.png\" class=\"" + c.icon + "\" /></a>"
     + "    <a class=\"" + c.info + "\" title=\"Stop following" + sanitize(user.screen_name) + "\" onclick=\"stopFollowingTweeter(" + tweet.id + ");\"><img src=\"chrome://buzzbird/content/images/stop-grey-16x16.png\" class=\"" + c.icon + "\" /></a>"
	 + "   </span>"
     + "  </div>"
     + " </div>"
     + "</div>"
     + "\n";

	//jsdump('tweet(' + tweet.id +'): ' + result);
	return result;
}

// Writes to the top of the page.
//
function insertAtTop(newText) {
	var doc = parser.parseFromString('<div xmlns="http://www.w3.org/1999/xhtml">' + newText + '</div>', 'application/xhtml+xml');
	if (doc.documentElement.nodeName != "parsererror" ) {
		var root = doc.documentElement;
		for (var j=0; j<root.childNodes.length; ++j) {
			window.content.document.body.insertBefore(document.importNode(root.childNodes[j], true),window.content.document.body.firstChild);
		}
	} else {
		message('An error was encountered while parsing tweets.');
//		alert('An error was encountered while parsing tweets.');
	}	
}

// Iterates over newly fetched tweets to add them to the browser window.
//
function renderNewTweets(url,newTweets) {
	jsdump('renderNewTweets, length: ' +newTweets.length+ ', for ' + url);
	if (newTweets.length == 0) {
		jsdump('renderNewTweets: Nothing to do, skipping.');
	} else {
		var newText = '';
		for (var i=0; i<newTweets.length; i++) {
			if (url.match('friends_timeline') && (mostRecentTweet == null || mostRecentTweet < newTweets[i].id)) {
				mostRecentTweet = newTweets[i].id;
				jsdump('mostRecentTweet:' + mostRecentTweet);
			} else if (url.match('direct_messages') && (mostRecentDirect == null || mostRecentDirect < newTweets[i].id)) {
				mostRecentDirect = newTweets[i].id;
				jsdump('mostRecentDirect:' + mostRecentDirect);
			}
			var chk = window.content.document.getElementById('tweet-'+newTweets[i].id);
			if (chk == null) {
				newText = formatTweet(newTweets[i]) + newText;
			}
		}
		insertAtTop(newText);
	}
}

// THE BIG CHEESE.
//
function fetchUrlCallback(transport,url,destinations) {
	jsdump('fetched ===> ' + url);
    var response = eval('(' + transport.responseText + ')');
	jsdump('url:' + url);
	renderNewTweets(url,response);
	fetchUrl(destinations);
}
function fetchFailureCallback(transport) {
 	progress(false); 
	refreshAllowed(true); 
	jsdump('Something went wrong: ' + transport.status + ', ' + transport.responseText);	
	message('Error: ' + transport.status);
}
function fetchUrl(destinations) {
	message("Fetching tweets");
	refreshAllowed(false);
	progress(true);
	var url = destinations.shift();

	if (url == undefined) {
		//
		// All done fetching
		//
		var d = new Date();
		var mins = d.getMinutes()
		if (mins < 10) {
			mins = '0' + mins;
		}
		updateLengthDisplay();		
		refreshAllowed(true);
		progress(false);
		setTimeout(updateTimestamps(),1000);
	} else {
		var since = url.match('friends_timeline') ? mostRecentTweet : mostRecentDirect;
		if ((url.match('friends_timeline') || url.match('direct_messages')) && since != null) {
			url = url + '?since_id=' + since;
		}
		jsdump('fetching ===>' + url);
		new Ajax.Request(url,
		  {
		    method:'get',
			httpUserName: getUsername(),
			httpPassword: getPassword(),
		    onSuccess: function(transport) { fetchUrlCallback(transport,url,destinations); },
		    onFailure: fetchFailureCallback
		  });	
	}
}

function fetchAll() {
	jsdump('in fetchAll');
	fetchUrl(['http://twitter.com/direct_messages.json','http://twitter.com/statuses/replies.json','http://twitter.com/statuses/friends_timeline.json']);
}
function fetch() {
	if(typeof fetchUrl === 'function') {
		fetchUrl(['http://twitter.com/statuses/friends_timeline.json','http://twitter.com/direct_messages.json']);
	} else {
		//jsdump('Hmph.  fetchUrl is not defined?  Trying again in 5 seconds.');
		//jsdump('Error - retrying.');
		getMainWindow().setTimeout(forceUpdate, 5000);
	}
}

// This function is called from the UI to request a tweet fetch.
// We need to reset the update timer when the user requests a 
// refresh to prevent our tweets from happening too closely
// together.
//
function forceUpdate() {
	// This stuff doesn't seem to work... not sure why?  I was just trying to cancel
	// a pending update and push it out to updateinterval seconds from now...
	//
	// var timer = getUpdateTimer();
	// jsdump('clearing timer #' + timer);
	// window.clearInterval(timer);
	// timer = window.setInterval(fetch,getIntPref('buzzbird.update.interval',180000));
	// jsdump('setting timer #' + timer);
	// getChromeElement('updateTimerId').value = timer;
	fetch();
}

// Called on succesful tweet postation
//
function postTweetCallback(tweetText) {
	var textbox = getChromeElement('textboxid');
	textbox.reset();
	textbox.disabled = false;
	getChromeElement('statusid').label = updateLengthDisplay();
	if (tweetText.match(/^d(\s){1}(\w+?)(\s+)(\w+)/)) {
		// It was a DM, need to display it manually.
		var tweet = {
			id : 0,
			text : "",
			created_at : new Date(),
			sender : "",
			user : {
			   	screen_name : "",
				profile_image_url : "",
				name : ""
			},
			source : ""
		};
		tweet.text = "Directly to " + tweetText.substring(2);
		tweet.sender = getUsername();
		tweet.user.screen_name = getUsername();
		tweet.user.profile_image_url = getChromeElement("avatarLabelId").value;
		tweet.user.name = getChromeElement("realnameLabelId").value;
		tweet.in_reply_to_screen_name = "";
		tweet.sender = undefined;
		insertAtTop(formatTweet(tweet));
	}
	forceUpdate();
}

// Posts a twitter update.
//
function postTweet() {
	var tweet = getChromeElement('textboxid').value;
	url = 'http://twitter.com/statuses/update.json';
	url = url + '?status=' + escape(tweet);
	new Ajax.Request(url,
		{
			method:'post',
			parameters:'source=buzzbird',
			httpUserName: getUsername(),
			httpPassword: getPassword(),
		    onSuccess: function() { postTweetCallback(tweet); },
		    onFailure: function() { alert('Error posting status update.'); postTweetCallback(); }
		});
}

// Runs on each key press in the tweet-authoring text area.
//
function keyPressed(e) {
	var textbox = getChromeElement('textboxid');
	if (e.which == 13) {
		textbox.disabled = true;
		postTweet();
	}
}

// Runs on each key up in the tweet-authoring text ara.
//
function keyUp(e) {
	updateLengthDisplay();
}

// Filter tweet types.
//
function showAllTweets() {
	showOrHide('tweet','inline');
	showOrHide('mine','inline');
	showOrHide('direct','inline');
	showOrHide('reply','inline');	
	getChromeElement('filterbuttonid').label="Showing all tweets";
}
function showResponses() {
	showOrHide('tweet','none');
	showOrHide('mine','none');
	showOrHide('direct','none');
	showOrHide('reply','inline');	
	getChromeElement('filterbuttonid').label="Showing replies";
}
function showDirect() {
	showOrHide('tweet','none');
	showOrHide('mine','none');
	showOrHide('direct','inline');
	showOrHide('reply','none');	
	getChromeElement('filterbuttonid').label="Showing direct messages";
}
function showOrHide(tweetType,display) {
	var elements = getBrowser().contentDocument.getElementsByName(tweetType);
	for (i=0, l=elements.length; i<l; ++i) {
		element = elements[i];
		element.style.display = display;
	}
}

// Marks all as read.
//
function markAllAsRead() {
	var xx = getBrowser().contentDocument.getElementsByName('mark');
	for (var i=0; i<xx.length; i++) {
		x = xx[i];
		x.src='chrome://buzzbird/content/images/checkmark-gray.png'; 
/*		x.name='marked';  */
	}	
}

function shortenUrl() {
	var params = {};
	window.openDialog("chrome://buzzbird/content/shorten.xul", "",
	    "chrome, dialog, modal, resizable=no",params).focus();
	if (params.out) {
		var url2shorten = params.out.urlid;
		url = 'http://is.gd/api.php?longurl=' + url2shorten;
		new Ajax.Request(url,
			{
				method:'post',
			    onSuccess: shortenCallback,
			    onFailure: function() { alert('Error shortening the URL.'); }
			});
	}
}
function shortenCallback(transport) {
	var shortenedUrl = transport.responseText;
	appendText(shortenedUrl);
}

function onShortenOk() {
	window.arguments[0].out = {urlid:document.getElementById("urlid").value};
	return true;
}

function onShortenCancel() {
	return true;
}


// Marks/Unmarks one tweet.
//
function toggleMarkAsRead(id) {
	var mark = 'mark-' + id;
	var f = $(mark);
	if (f.src=='chrome://buzzbird/content/images/star-yellow.png') {
		f.src='chrome://buzzbird/content/images/checkmark-gray.png'; 
	} else {
		f.src='chrome://buzzbird/content/images/star-yellow.png'; 
	}
}

function appendText(symbol) {
	var t = getChromeElement('textboxid').value;
	t = t + symbol;
	var len = t.length;
	getChromeElement('textboxid').value = t;
	getChromeElement('statusid').label = len + '/140';
}


function quitApplication(aForceQuit) {
  var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].getService(Components.interfaces.nsIAppStartup);

  // eAttemptQuit will try to close each XUL window, but the XUL window can cancel the quit
  // process if there is unsaved data. eForceQuit will quit no matter what.
  var quitSeverity = aForceQuit ? Components.interfaces.nsIAppStartup.eForceQuit :
                                  Components.interfaces.nsIAppStartup.eAttemptQuit;
  appStartup.quit(quitSeverity);
}

function openPreferences() {
  var instantApply = getBoolPref("browser.preferences.instantApply", false);
  var features = "chrome,titlebar,toolbar,centerscreen" + (instantApply ? ",dialog=no" : ",modal");

//	var features = "chrome,titlebar,toolbar,centerscreen,modal";
	window.openDialog("chrome://buzzbird/content/prefs.xul", "", features);
}



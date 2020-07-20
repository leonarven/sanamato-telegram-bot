class OfflineTelegramBot {
	constructor( token, config ) {}
	on() {}
	onText() {}
}


const chats = {};
class Chat {
	constructor( chat = {} ) {
		for (var id in chat) this[id] = chat[id];

		Object.defineProperty( this, 'title', {
			get: () => {
				switch (this.type) {
					case "private": return this.username;
				}
				return this.id;
			}
		});
		
		Object.defineProperty( this, 'users', { value: {} });

		console.debug( "new Chat() ::", this );
	}

	static get( chat = {} ){
		if (typeof chat == "string" || typeof chat == "number") return chats[ chat ];

		if (typeof chat != "object" || !chat.id) return null;

		return (chats[ chat.id ] = chats[ chat.id ] || new Chat( chat ));
	}
}


var __messageSendTimeout = null;
class MessageSender {
	constructor( bot ) {
		var self = this;

		this.bot = bot;

		Object.defineProperty( this, "__messages", { value: [] });
		this.__messages.push = message => {
			var ret = Array.prototype.push.call( this.__messages, message );
			setTimeout(() => this.__sendMessageRefresh() );
			return ret;
		};
	}

	sendMessage( chatId, message, opts = {} ) {
		if (typeof opts.disable_notification == "undefined") opts.disable_notification = true; 

		if (typeof chatId == "object" && typeof chatId.id != "undefined") chatId = chatId.id;

		if (chatId == null) {
			return Promise.resolve( console.log( "sendMessage() :: Message not sended, no chatId" ));
		}

		if (!Array.isArray( message )) message = [ message ];
		
		return message.forEach(( msg, i ) => this.__messages.push([ chatId, msg, opts ]));
	}

	__sendMessageRefresh() {
		if (!__messageSendTimeout && this.__messages.length > 0) {
			__messageSendTimeout = setTimeout( message => {
				__messageSendTimeout = null;
				
				if (!message) return;

				console.log( "sendMessage( chatId, msg, opts ) ::", message );
			
				this.bot.sendMessage.apply( this.bot, message ).catch( err => {
					console.error( "ERROR@__sendMessageRefresh()-cycle :: bot.sendMessage got rejected:", err, "message:", message );
				}).finally(() => this.__sendMessageRefresh() );
			}, 250, this.__messages.splice( 0, 1 )[0]);
		} 
	}
}


module.exports = {
	TelegramBot: require( 'node-telegram-bot-api' ),
	OfflineTelegramBot, MessageSender, Chat
};

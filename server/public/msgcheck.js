/* SafeHer message checker engine. Runs fully in the browser (also loads in Node for tests).
   Each rule: id, category, weight, patterns (RegExp, matched with the g flag so every hit is highlighted),
   and a plain-language reason in English, Hindi and Marathi.
   Languages covered by patterns: English, Hindi (Devanagari), Marathi (Devanagari), Hinglish (Hindi in Latin letters).
   Devanagari has no \b word boundaries in JS, so those patterns are plain substrings. */
(function(root){
"use strict";
const CATS={
 cred:{en:"Asks for secrets",hi:"गोपनीय जानकारी मांगना",mr:"गोपनीय माहिती मागणे"},
 money:{en:"Money",hi:"पैसे",mr:"पैसे"},
 pressure:{en:"Pressure",hi:"दबाव",mr:"दबाव"},
 impersonation:{en:"Pretending to be an authority",hi:"अधिकारी बनकर ठगी",mr:"अधिकारी असल्याचे भासवणे"},
 threat:{en:"Threat",hi:"धमकी",mr:"धमकी"},
 lure:{en:"Too-good-to-be-true offer",hi:"लालच",mr:"आमिष"},
 link:{en:"Link or app",hi:"लिंक या ऐप",mr:"लिंक किंवा ॲप"},
 social:{en:"Emotional manipulation",hi:"भावनात्मक चाल",mr:"भावनिक फसवणूक"}
};
const R=(id,cat,w,pats,en,hi,mr)=>({id,cat,w,pats,msg:{en,hi,mr}});
const RULES=[
 R("otp","cred",3,[
  /\b(otp|one[- ]?time[- ]?(password|pass ?code|code)|cvv|cvc|atm pin|upi pin|mpin|net ?banking (password|id)|card number|expiry date)\b/gi,
  /\b(otp|pin|password|cvv)\b.{0,30}\b(share|send|bata(o|na|iye)?|batao|dena|de do|bhejo|bhej do|sang|sanga|dya)\b/gi,
  /(ओटीपी|ओ\.टी\.पी|पिन नंबर|पासवर्ड|सीवीवी|कार्ड नंबर)/g,
  /\b(code|otp)\b.{0,25}\b(whatsapp|telegram)\b.{0,25}\b(verify|verification|share|forward)\b/gi,
  /\b(send|give|tell|read out|forward|(?<!not )(?<!never )(?<!n't )share)( me| us| him| her)?( the| your| that| this)?( \w+)? (otp|code|pin|password)\b/gi],
  "Asks for an OTP, PIN, CVV or password. Real banks and apps never ask for these.",
  "OTP, पिन, CVV या पासवर्ड मांगा जा रहा है। असली बैंक या ऐप कभी ये नहीं मांगते।",
  "OTP, पिन, CVV किंवा पासवर्ड मागितला जात आहे. खरी बँक किंवा ॲप हे कधीच मागत नाहीत."),
 R("otpinfo","cred",1,[
  /\b(do not|don'?t|never|not to) share\b.{0,40}\b(otp|code|pin)\b/gi,
  /\b(otp|code)\b.{0,20}\b(is|:)\s*\d{4,8}\b/gi],
  "Looks like a genuine OTP notice. Never tell the code to anyone, even someone who says they are from the bank.",
  "यह असली OTP सूचना जैसा लगता है। यह कोड किसी को न बताएं, बैंक का नाम लेने वाले को भी नहीं।",
  "हे खऱ्या OTP सूचनेसारखे वाटते. हा कोड कोणालाही सांगू नका, बँकेचे नाव सांगणाऱ्यालाही नाही."),
 R("kyc","cred",3,[
  /\b(kyc|re-?kyc|(update|verify|link|complete) (your )?(pan|aadhaar|aadhar|kyc|bank details|account))\b/gi,
  /\b(account|card|sim|number|upi|wallet)\b.{0,30}\b(will be |is |has been |gets? )?(blocked|suspended|frozen|closed|deactivated|disconnected|band|block)\b/gi,
  /(केवाईसी|केवायसी|खाता.{0,15}(बंद|ब्लॉक)|अकाउंट.{0,15}(बंद|ब्लॉक)|खाते.{0,15}(बंद|ब्लॉक))/g,
  /\b(khata|account)\b.{0,20}\b(band|block)\b.{0,15}\b(ho jayega|hoga|ho jaye)\b/gi],
  "Fake bank, SIM or KYC warning. Banks do not block accounts over SMS links.",
  "फर्जी बैंक, सिम या KYC चेतावनी। बैंक SMS लिंक से खाता बंद नहीं करते।",
  "बनावट बँक, सिम किंवा KYC इशारा. बँका SMS लिंकवरून खाते बंद करत नाहीत."),
 R("urgent","pressure",2,[
  /\b(urgent(ly)?|immediately|right now|asap|last chance|act now|final notice|final warning|hurry|limited time|today only|within \d+ ?(minutes?|mins?|hours?|hrs?)|expires? (today|soon|in \d+))\b/gi,
  /(तुरंत|अभी के अभी|फौरन|आखिरी मौका|जल्दी करें|आज ही|तत्काळ|लगेच|ताबडतोब|शेवटची संधी|आजच)/g,
  /\b(turant|abhi|jaldi|foran|aaj hi|aakhri mauka|lagech|tatkal|tabadtob)\b/gi],
  "Creates pressure to act fast so you do not stop to think.",
  "जल्दबाज़ी का दबाव बनाया जा रहा है ताकि आप सोच न सकें।",
  "घाई करायला लावून विचार करू देत नाहीत."),
 R("prize","lure",2,[
  /\b(you (have |'ve )?won|you are (the )?(lucky )?winner|lucky draw|lottery|jackpot|prize|reward points?|cashback|gift card|free (iphone|gift|recharge|data)|claim your)\b/gi,
  /(इनाम|लॉटरी|जीत(े|ा|ी|ने)? (हैं|है|लिया)|बधाई हो|ईनाम|बक्षीस|लकी ड्रॉ|तुम्ही जिंकला|तुम्ही जिंकले)/g,
  /\b(inaam|inam|bakshis|jeet (liya|gaye)|badhai ho)\b/gi],
  "Too-good-to-be-true prize or reward. You cannot win a contest you did not enter.",
  "बहुत अच्छा लगने वाला इनाम। जिस प्रतियोगिता में आपने भाग नहीं लिया उसमें जीत नहीं सकते।",
  "खूपच आकर्षक बक्षीस. ज्यात भाग घेतला नाही ते जिंकता येत नाही."),
 R("sendmoney","money",3,[
  /\b(send|transfer|pay|deposit|remit|bhejo|bhej do|de do|dena|pathva|pathav|dya)\b.{0,40}(₹|rs\.?|inr|\$|usd|upi|gift ?cards?|bitcoin|crypto|usdt|rupees?|rupaye|रुपये|रुपए)/gi,
  /(₹|rs\.?|inr)\s?\d[\d,]*.{0,30}\b(fee|charges?|deposit|tax|fine|penalty|registration|processing)\b/gi,
  /\b(processing|registration|clearance|customs|delivery|release|refundable) (fee|charge|deposit)s?\b/gi,
  /(पैसे|रुपये|रुपए|पैसा).{0,20}(भेज|ट्रांसफर|जमा)|(पैसे|रुपये).{0,20}(पाठव|भर)/g],
  "Asks you to send money or pay a fee before you get anything.",
  "कुछ मिलने से पहले पैसे या शुल्क भेजने को कहा जा रहा है।",
  "काही मिळण्यापूर्वी पैसे किंवा शुल्क भरायला सांगत आहेत."),
 R("upi","money",2,[
  /\b(collect request|payment request|request money|scan (this|the|my) (qr|code)|qr code)\b/gi,
  /\b(accept|approve|enter (your )?pin).{0,30}(request|collect|receive)\b/gi,
  /\b(phonepe|gpay|google ?pay|paytm|bhim)\b.{0,40}\b(request|pin|scan)\b/gi],
  "Mentions a UPI request or QR scan. You never need to enter a PIN or scan a code to receive money.",
  "UPI रिक्वेस्ट या QR स्कैन का ज़िक्र। पैसे पाने के लिए PIN डालना या QR स्कैन करना नहीं पड़ता।",
  "UPI विनंती किंवा QR स्कॅनचा उल्लेख. पैसे मिळवायला PIN टाकावा लागत नाही."),
 R("shortlink","link",2,[
  /\b(bit\.ly|tinyurl\.com|t\.co|cutt\.ly|goo\.gl|rb\.gy|is\.gd|shorturl\.at|ow\.ly|tiny\.cc|wa\.link|t\.me)\/\S*/gi,
  /https?:\/\/\d{1,3}(\.\d{1,3}){3}\S*/gi,
  /\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(xyz|top|click|loan|icu|buzz|cfd|sbs|vip|work|rest|monster|support|live)(\/\S*)?\b/gi],
  "Contains a shortened or unusual link that hides where it really goes.",
  "छोटी या अजीब लिंक जो असली पता छिपाती है।",
  "छोटी किंवा संशयास्पद लिंक जी खरा पत्ता लपवते."),
 R("fakebank","link",3,[
  /\b[a-z0-9.-]*(sbi|hdfc|icici|axis|kotak|paytm|pnb|bob|irctc|incometax|uidai|npci|amazon|flipkart|jio|airtel)[a-z0-9.-]*(-|\.)(kyc|update|verify|secure|login|bank|care|support|refund|reward|offer|claim)[a-z0-9.-]*\.[a-z]{2,}\S*/gi,
  /\b[a-z0-9-]*(kyc|verify|secure|refund|reward)[a-z0-9-]*(sbi|hdfc|icici|axis|kotak|paytm|pnb|irctc|uidai)[a-z0-9-]*\.[a-z]{2,}\S*/gi],
  "The link imitates a bank or government website. Check the exact address, or type the official one yourself.",
  "लिंक किसी बैंक या सरकारी वेबसाइट की नकल लगती है। असली पता खुद टाइप करें।",
  "लिंक बँक किंवा सरकारी संकेतस्थळाची नक्कल वाटते. अधिकृत पत्ता स्वतः टाइप करा."),
 R("apk","link",3,[
  /\b[\w.-]+\.apk\b/gi,
  /\b(install|download).{0,30}\b(app|apk|application)\b.{0,40}\b(verify|kyc|update|reward|claim|refund|support)\b/gi,
  /\b(anydesk|teamviewer|quick ?support|rustdesk|airdroid|screen ?share|remote access)\b/gi],
  "Asks you to install an app or share your screen. This gives scammers control of your phone and bank apps.",
  "ऐप इंस्टॉल करने या स्क्रीन शेयर करने को कहा जा रहा है। इससे ठग आपके फोन और बैंक ऐप पर कब्ज़ा कर सकते हैं।",
  "ॲप इन्स्टॉल किंवा स्क्रीन शेअर करायला सांगत आहेत. यामुळे ठग तुमच्या फोन व बँक ॲपचा ताबा घेऊ शकतात."),
 R("blackmail","threat",4,[
  /\b(leak|viral|expose you|morphed|deep ?fake|nudes?|nude (photos?|videos?|pics?)|sextortion|your (private )?(photos|videos|pictures|pics|chats?))\b/gi,
  /\b(i (will|'ll|am going to|shall) (post|share|send|upload|leak|publish)|will (make|go) viral|send (it )?to (your )?(family|friends|husband|parents|contacts))\b/gi,
  /(वायरल कर|वायरल करे|तस्वीरें.{0,15}(भेज|डाल)|वीडियो.{0,15}(वायरल|भेज)|फोटो.{0,15}(वायरल|भेज)|व्हायरल (करीन|करेन|करू))/g,
  /\b(viral kar|photo(s)? viral|video viral|bhej dunga|bhej dungi|sabko bhej)\b/gi],
  "Sounds like blackmail or a threat to share your images. This is a crime, and it is not your fault.",
  "यह ब्लैकमेल या आपकी तस्वीरें फैलाने की धमकी जैसा लगता है। यह अपराध है और आपकी गलती नहीं है।",
  "हे ब्लॅकमेल किंवा तुमचे फोटो पसरवण्याच्या धमकीसारखे वाटते. हा गुन्हा आहे आणि तुमची चूक नाही."),
 R("secret","social",3,[
  /\b(don'?t tell (anyone|anybody|your)|do not tell|keep (this|it) (a )?(secret|confidential|between us)|only between us|delete this (message|chat)|tell no one|dont share with (anyone|family))\b/gi,
  /(किसी को (मत|न) बता|राज़ रख|गुप्त रख|किसीला सांगू नका|कुणालाही सांगू नका|गुपित ठेवा)/g,
  /\b(kisi ko mat bata|kisi ko na bata|raaz rakh|secret rakh|kunala sangu nako)\b/gi],
  "Asks you to keep it secret. Scammers isolate you so no one can warn you.",
  "इसे गुप्त रखने को कहा जा रहा है। ठग आपको अकेला करते हैं ताकि कोई आपको चेतावनी न दे सके।",
  "गुप्त ठेवायला सांगत आहेत. ठग तुम्हाला एकटे पाडतात म्हणजे कोणी सावध करू नये."),
 R("askmedia","social",2,[
  /\b(send|share|show|bhejo|bhej)\b.{0,20}\b(photo|pic|selfie|video|location|address|live location|nude)s?\b/gi,
  /\b(video call|vc)\b.{0,20}\b(now|naked|without|private|nude)\b/gi,
  /(फोटो|तस्वीर|वीडियो|लोकेशन|पता).{0,15}(भेज|शेयर)|(फोटो|व्हिडिओ|लोकेशन).{0,15}(पाठव|शेअर)/g],
  "Asks for photos, video or your location. Do not share these with someone you do not know and trust.",
  "फोटो, वीडियो या लोकेशन मांगी जा रही है। अनजान व्यक्ति को ये न भेजें।",
  "फोटो, व्हिडिओ किंवा लोकेशन मागत आहेत. अनोळखी व्यक्तीला हे पाठवू नका."),
 R("police","impersonation",3,[
  /\b(cbi|ncb|ed|customs|narcotics|cyber ?crime|trai|rbi|income ?tax|police|crime branch|supreme court|mumbai police|delhi police)\b.{0,80}\b(arrest|warrant|case|fir|notice|drugs?|parcel|illegal|money laundering|summons|complaint|stay on (video )?call)\b/gi,
  /\b(digital arrest|arrest warrant|you are (under )?arrest|video call.{0,20}(police|officer|cbi)|stay (on|in) (the )?(video )?call)\b/gi,
  /(गिरफ्तार|गिरफ्तारी|वारंट|सीबीआई|पुलिस.{0,30}(केस|पार्सल|ड्रग)|अटक|पोलीस.{0,30}(केस|पार्सल|ड्रग))/g,
  /\b(giraftar|giraftari|digital giraftari|atak)\b/gi],
  "Possible fake police, CBI or customs call. No agency arrests people by video call or asks for money to close a case.",
  "फर्जी पुलिस, CBI या कस्टम का मामला हो सकता है। कोई एजेंसी वीडियो कॉल पर गिरफ्तार नहीं करती और न पैसे मांगती है।",
  "बनावट पोलीस, CBI किंवा कस्टम्सचा प्रकार असू शकतो. कोणतीही यंत्रणा व्हिडिओ कॉलवर अटक करत नाही."),
 R("parcel","impersonation",3,[
  /\b(fedex|dhl|blue ?dart|india post|dtdc|delhivery|courier|parcel|package|shipment|consignment)\b.{0,80}\b(held|seized|stuck|pending|undelivered|illegal|drugs?|passports?|customs|fee|address|confirm|reschedule)\b/gi,
  /\b(your (parcel|package|order|delivery)).{0,40}(could not be|failed|on hold|returned)\b/gi,
  /(पार्सल|कूरियर).{0,40}(पकड़|रोक|ड्रग|फीस|शुल्क)|(पार्सल|कुरिअर).{0,40}(पकडले|थांबवले|ड्रग|शुल्क)/g],
  "Fake courier or parcel problem, a common way to start a customs or police scam.",
  "फर्जी कूरियर या पार्सल की समस्या, जो अक्सर कस्टम या पुलिस ठगी की शुरुआत होती है।",
  "बनावट कुरिअर किंवा पार्सल समस्या, जी अनेकदा कस्टम्स/पोलीस फसवणुकीची सुरुवात असते."),
 R("job","lure",3,[
  /\b(work from home|part[- ]time (job|work)|earn.{0,20}(daily|per day|weekly|monthly|₹|rs\.?|\$)|like (and|&) (subscribe|share)|task(s)? (to|and) earn|commission|data entry job|rating (job|task)|youtube (like|task)|hiring now|no experience (needed|required)|daily income|salary.{0,10}per (day|week))\b/gi,
  /(घर बैठे.{0,20}(कमाओ|कमाएं|कमाई)|पार्ट टाइम जॉब|रोज़ (कमाओ|कमाएं)|घरबसल्या.{0,20}(कमवा|कमाई)|पार्ट टाइम नोकरी)/g,
  /\b(ghar baithe|ghar baithe kamao|ghar basalya|daily kamao|roz kamao)\b/gi],
  "Looks like a fake job or task scam. Real employers never ask you to pay or do paid tasks to earn.",
  "फर्जी नौकरी या टास्क ठगी जैसा लगता है। असली नियोक्ता पैसे लगवाकर कमाई नहीं करवाते।",
  "बनावट नोकरी किंवा टास्क फसवणुकीसारखे वाटते. खरे नियोक्ते पैसे भरायला लावत नाहीत."),
 R("invest","lure",3,[
  /\b(guaranteed (returns?|profit)|double (your )?money|100% (profit|returns?|safe)|risk[- ]free|insider tip|stock tips?|vip (group|signals?)|crypto (trading|investment)|trading (group|platform)|forex|binary option|ipo (allotment|guaranteed)|daily profit)\b/gi,
  /\b(\d{2,3}\s?%).{0,20}\b(returns?|profit|monthly|weekly|daily)\b/gi,
  /(गारंटी.{0,15}(रिटर्न|मुनाफा|मुनाफ़ा)|पैसे दुगने|दोगुना|हमी.{0,15}(परतावा|नफा)|पैसे दुप्पट)/g],
  "Promises guaranteed or very high returns. All real investments carry risk.",
  "गारंटीड या बहुत ज़्यादा रिटर्न का वादा। हर असली निवेश में जोखिम होता है।",
  "हमखास किंवा खूप जास्त परताव्याचे आश्वासन. प्रत्येक खऱ्या गुंतवणुकीत जोखीम असते."),
 R("utility","pressure",3,[
  /\b(electricity|power|bijli|light|mseb|mahavitaran|adani electricity|tata power|gas|water) (bill|connection|supply)\b.{0,60}\b(disconnect|cut|suspend|terminate|overdue|unpaid|tonight|9[: ]?30)\b/gi,
  /\b(sim|mobile number|number)\b.{0,30}\b(disconnect|deactivat|block|suspend|terminat)\w*\b.{0,40}\b(trai|dot|police|hours|today)\b/gi,
  /(बिजली.{0,20}(कट|कनेक्शन|बिल)|वीज.{0,20}(कट|बिल|खंडित)|आज रात)/g],
  "Fake bill or disconnection threat. Check your bill in the official app, never through a number in a message.",
  "फर्जी बिल या कनेक्शन कटने की धमकी। बिल आधिकारिक ऐप में देखें, मैसेज वाले नंबर से नहीं।",
  "बनावट बिल किंवा वीज/कनेक्शन तोडण्याची धमकी. बिल अधिकृत ॲपमध्ये तपासा, मेसेजमधील नंबरवरून नाही."),
 R("refund","money",2,[
  /\b(tax refund|income ?tax refund|refund (is )?(pending|approved|available|processed)|wrongly (sent|transferred)|sent (money )?by mistake|please return|returned? the (amount|money)|claim (your )?refund)\b/gi,
  /(रिफंड|गलती से.{0,20}(भेज|ट्रांसफर)|चुकून.{0,20}(पाठव|ट्रान्सफर)|परतावा)/g],
  "Refund or 'sent by mistake' story. Scammers use this to get your bank details or money.",
  "रिफंड या 'गलती से पैसे चले गए' वाली कहानी। ठग इससे बैंक डिटेल या पैसे निकालते हैं।",
  "रिफंड किंवा 'चुकून पैसे गेले' अशी कथा. ठग याने बँक तपशील किंवा पैसे घेतात."),
 R("support","impersonation",2,[
  /\b(customer (care|support|service)|helpline|toll[- ]?free|support number|call (us )?(on|at|now)|contact (our )?(agent|executive|manager))\b.{0,40}\+?\d[\d -]{7,}/gi,
  /\b(your|ur) (whatsapp|account|paytm|bank|amazon|netflix|instagram)\b.{0,30}\b(hacked|compromised|suspicious|unusual|locked|limited)\b/gi,
  /(कस्टमर केयर|हेल्पलाइन).{0,30}\d{8,}/g],
  "A 'support' number sent to you in a message is a classic trap. Find the real number on the official site or card.",
  "मैसेज में आया 'सपोर्ट' नंबर अक्सर जाल होता है। असली नंबर आधिकारिक साइट या कार्ड से लें।",
  "मेसेजमध्ये आलेला 'सपोर्ट' नंबर बहुधा सापळा असतो. खरा नंबर अधिकृत साइट किंवा कार्डवरून घ्या."),
 R("movechat","social",1,[
  /\b(move|switch|shift|continue|join|chat|talk|text|message)\b.{0,25}\b(telegram|whatsapp|signal|insta(gram)?|hangouts?)\b/gi,
  /\b(telegram|whatsapp)\b.{0,10}(par|pe|वर|पर)\b/gi],
  "Pushes you to another app where it is harder to report or trace.",
  "आपको दूसरे ऐप पर जाने को कह रहा है जहां शिकायत और पता लगाना मुश्किल है।",
  "तुम्हाला दुसऱ्या ॲपवर जायला सांगत आहे जिथे तक्रार व मागोवा घेणे कठीण असते."),
 R("generic","social",1,[
  /\b(dear (customer|user|sir|madam|beneficiary|friend|winner|account holder|valued)|congratulations|greetings of the day)\b/gi,
  /(प्रिय ग्राहक|प्रिय उपयोगकर्ता|आदरणीय ग्राहक|प्रिय ग्राहक)/g],
  "Generic greeting from an unknown sender. Real companies use your name.",
  "अनजान भेजने वाले की सामान्य शुभकामना। असली कंपनियां आपका नाम लिखती हैं।",
  "अनोळखी प्रेषकाचे सर्वसाधारण संबोधन. खऱ्या कंपन्या तुमचे नाव वापरतात."),
 R("romance","social",2,[
  /\b(i love you|my dear|darling|sweetheart|in trouble|stuck at (the )?airport|medical emergency|hospital bill|visa fee|customs fee|inheritance|widow|army (officer|doctor)|oil rig|gift (parcel|package) (for you|from)|send(ing)? you (a )?gift)\b/gi,
  /(अस्पताल का खर्च|मुसीबत में हूं|मैं मुश्किल में|हॉस्पिटल बिल|अडचणीत आहे)/g],
  "An emotional story that may lead to a money request. Never send money to someone you have not met in person.",
  "भावनात्मक कहानी जो आगे चलकर पैसे की मांग बन सकती है। जिससे मिले नहीं, उसे पैसे न भेजें।",
  "भावनिक कथा जी पुढे पैशांच्या मागणीकडे नेऊ शकते. प्रत्यक्ष भेटले नाही त्यांना पैसे पाठवू नका."),
 R("rental","money",2,[
  /\b(token amount|advance (booking|payment)|security deposit|booking amount)\b.{0,60}\b(before|first|now|upi|gpay|phonepe|paytm|send)\b/gi,
  /\b(army|cisf|crpf|transferred).{0,40}\b(flat|room|olx|rent|vehicle|car|bike)\b/gi],
  "Advance payment before you see the item or home. A common rental and marketplace scam, especially claims of army transfers.",
  "सामान या घर देखने से पहले एडवांस की मांग। किराये और OLX जैसी ठगी का आम तरीका।",
  "वस्तू/घर पाहण्यापूर्वी आगाऊ रकमेची मागणी. भाडे व मार्केटप्लेस फसवणुकीचा सामान्य प्रकार.")
];

/* Combination boosts: dangerous pairs of categories */
const COMBOS=[
 [["pressure","cred"],2],[["pressure","money"],2],[["impersonation","money"],2],[["link","cred"],2],[["lure","money"],2],[["threat","money"],1],[["pressure","link"],1],[["lure","link"],1]
];

function detectLang(t){
 const dev=(t.match(/[\u0900-\u097F]/g)||[]).length,lat=(t.match(/[A-Za-z]/g)||[]).length;
 if(dev>lat*0.3&&dev>=3){
  const mr=/(आहे|आहेत|तुमचे|तुम्ही|नका|करा|म्हणून|मला|आम्ही|करावे|होईल|पाठवा|उद्या|सकाळी|तुला|करतो|करते|मी |भेटू)/.test(t),hi=/(है|हैं|आपका|आपकी|कृपया|करें|नहीं|और|के लिए|होगा|भेजें)/.test(t);
  return mr&&!hi?"mr":"hi";
 }
 if(/\b(aapka|aapki|apna|apni|kripya|turant|jaldi|paisa|paise|bhejo|bhej|batao|karo|karein|hai|hain|nahi|nahin|mat|ghar|khata|abhi|tum|aap|kya|raha|rahi|hoga|jayega)\b/i.test(t)&&lat>0)return "hinglish";
 return "en";
}

const SAFEOTP=/\b(do not|don'?t|never|not to) share\b/i;
function analyze(text,opts){
 opts=opts||{};const muted=new Set(opts.muted||[]);
 const hits=[];
 for(const r of RULES){
  if(muted.has(r.id))continue;
  const spans=[];
  /* A bare mention of "OTP" next to a warning like "do not share" is a normal bank notice, not a request. */
  const pats=r.id==="otp"&&SAFEOTP.test(text)?r.pats.slice(2):r.pats;
  for(const re of pats){re.lastIndex=0;let m;while((m=re.exec(text))){if(m[0]==="")  {re.lastIndex++;continue}
   spans.push([m.index,m.index+m[0].length]);if(spans.length>=6)break}}
  if(spans.length)hits.push({id:r.id,cat:r.cat,w:r.w,msg:r.msg,spans:merge(spans)});
 }
 let score=hits.reduce((s,h)=>s+h.w,0);
 const cats=new Set(hits.map(h=>h.cat));
 for(const[[a,b],bonus]of COMBOS)if(cats.has(a)&&cats.has(b))score+=bonus;
 const level=hits.some(h=>h.w===4)||score>=7?"high":score>=3?"med":score>=1?"low":"none";
 return{score,level,hits,lang:detectLang(text),marks:buildMarks(hits)};
}
function merge(sp){sp.sort((a,b)=>a[0]-b[0]);const o=[];for(const s of sp){const l=o[o.length-1];if(l&&s[0]<=l[1])l[1]=Math.max(l[1],s[1]);else o.push(s.slice())}return o}
/* Merge overlapping or touching spans into one highlight each. A highlight lists every rule that covers it; the highest-weight rule sets its colour. */
function buildMarks(hits){
 const ev=[];hits.forEach((h,i)=>h.spans.forEach(s=>ev.push({s:s[0],e:s[1],i,w:h.w})));
 ev.sort((a,b)=>a.s-b.s||a.e-b.e);const out=[];
 for(const x of ev){const l=out[out.length-1];
  if(l&&x.s<=l.e){l.e=Math.max(l.e,x.e);if(!l.ids.includes(x.i))l.ids.push(x.i);if(x.w>l.w){l.w=x.w;l.top=x.i}}
  else out.push({s:x.s,e:x.e,top:x.i,w:x.w,ids:[x.i]})}
 out.forEach(m=>m.ids.sort((a,b)=>a-b));return out;
}
/* URLs found in the text, for showing the real domain */
function links(t){const re=/\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi,o=[];let m;
 while((m=re.exec(t))){const u=m[0].replace(/[.,;:!?)]+$/,"");if(/^\d+(\.\d+)?$/.test(u))continue;o.push(u)}return[...new Set(o)].slice(0,5)}

const api={RULES,CATS,analyze,detectLang,links};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.MC=api;
})(typeof self!=="undefined"?self:this);

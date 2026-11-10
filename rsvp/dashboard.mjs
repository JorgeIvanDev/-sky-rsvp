// Small, dependency-free organizer dashboard. Never put organizer secrets in URLs.
export function summarizeReplies(replies){
 const totals={yes:0,maybe:0,no:0};
 for(const reply of replies){
  if(Object.hasOwn(totals,reply.choice))totals[reply.choice]++;
 }
 return totals;
}
export function renderReplySummary(root,replies){
 const totals=summarizeReplies(replies);
 const labels=[['yes',"I'm in"],['maybe','Maybe'],['no',"Can't make it"]];
 root.replaceChildren();
 for(const [choice,label] of labels){
  const item=root.ownerDocument.createElement('p');
  const count=root.ownerDocument.createElement('strong');
  count.textContent=String(totals[choice]);
  item.append(count,root.ownerDocument.createTextNode(' '+label));
  root.append(item);
 }
 // Show the actual server-verified receipts, not only aggregate counts.
 // Use text nodes exclusively: untrusted response fields must never become HTML.
 if(replies.length){
  const list=root.ownerDocument.createElement('ol');
  list.setAttribute('aria-label','Recent RSVP receipts');
  list.style.gridColumn='1 / -1';
  for(const reply of replies){
   const item=root.ownerDocument.createElement('li');
   const choice=labels.find(([key])=>key===reply.choice)?.[1] ?? 'Unknown';
   const date=new Date(reply.savedAt);
   item.textContent=choice+' · '+(Number.isFinite(date.getTime())?date.toLocaleString():'Time unavailable')+' · Receipt '+String(reply.receiptId).slice(0,12);
   list.append(item);
  }
  root.append(list);
 }
 return totals;
}

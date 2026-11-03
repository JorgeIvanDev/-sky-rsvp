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
 return totals;
}

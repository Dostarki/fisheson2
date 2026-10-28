import { Home, ShoppingBasket, Footprints, Clock } from 'lucide-react';
const STATES={home:['At home',Home],to_market:['Walking to market',Footprints],waiting:['Waiting for fresh fish',Clock],returning:['Taking fish home',ShoppingBasket]};
export const VillageResidents=({villagers=[],paused})=><section className="village-residents" data-testid="village-residents">
  <div className="ledger-heading"><span data-testid="village-life-heading">VILLAGE LIFE</span><span data-testid="village-resident-count">{villagers.length} NEIGHBORS</span></div>
  <div className="resident-list">{villagers.map(v=>{
    const [label,Icon]=STATES[v.state]||STATES.home;
    return <div className={`resident-row resident-${v.state}`} key={v.id} data-testid={`resident-${v.id}`}>
      <span className="resident-avatar" style={{'--resident-color':v.color}}><Icon size={15}/></span>
      <div><strong data-testid={`resident-name-${v.id}`}>{v.name}</strong><span data-testid={`resident-home-${v.id}`}>{v.home}</span></div>
      <span className="resident-status" data-testid={`resident-status-${v.id}`}>{paused?'Taking a breather':label}{v.state==='returning'&&<small data-testid={`resident-fish-${v.id}`}>{v.carried_fish} fish in the basket</small>}</span>
    </div>;
  })}</div>
</section>;
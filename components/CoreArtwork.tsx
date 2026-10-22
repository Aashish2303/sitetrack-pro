/** Original vector artwork: outlined components, blue geometry and gold details. */
export default function CoreArtwork({compact=false}:{compact?:boolean}) {
  return <div className={'core-artwork '+(compact?'is-compact':'')} aria-hidden="true">
    <svg viewBox="0 0 540 360" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs><pattern id={compact?'core-grid-small':'core-grid'} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" stroke="#24344d" strokeOpacity=".45" strokeWidth=".7"/></pattern></defs>
      <rect x="28" y="24" width="480" height="312" fill={`url(#${compact?'core-grid-small':'core-grid'})`}/>
      <circle cx="391" cy="58" r="25" fill="#5156f5"/><circle cx="430" cy="58" r="25" fill="#29436a"/><circle cx="469" cy="58" r="25" fill="#182e4b"/>
      <path d="M44 128H191V165H44z" stroke="#36517a"/><path d="M44 116H112" stroke="#e7ecf3" strokeWidth="2"/>
      <rect x="237" y="109" width="32" height="32" rx="3" fill="#5156f5"/><path d="M246 125H260M253 118V132" stroke="white" strokeWidth="2"/>
      <rect x="280" y="109" width="32" height="32" rx="3" fill="#30343d"/><path d="M289 125H303M296 118V132" stroke="white" strokeWidth="2"/>
      <path d="M351 125H493" stroke="#29436a"/><circle cx="401" cy="125" r="5" fill="#fcbf02"/>
      <rect x="51" y="206" width="150" height="32" rx="16" stroke="#36517a"/><path d="M68 222H157M177 217L187 227M187 217L177 227" stroke="#c0c8d7" strokeWidth="1.5"/>
      <rect x="253" y="185" width="255" height="150" rx="7" fill="#11161c" stroke="#29436a" strokeWidth="1.5"/>
      <rect x="223" y="236" width="91" height="99" rx="6" fill="#101419" stroke="#36517a"/>
      <path d="M268 236V220L339 178L410 220V312M339 178V312M268 220L339 262L410 220M292 206V281M315 193V295M362 193V295M386 206V281M268 251L339 293L410 251M268 281L320 312" stroke="#36517a" strokeWidth="1.2"/>
      <path d="M268 220L339 178L410 220" stroke="#fcbf02" strokeWidth="2"/><circle cx="339" cy="178" r="3.5" fill="#fcbf02"/>
      <circle cx="123" cy="299" r="30" stroke="#29436a" strokeWidth="9"/><path d="M123 269a30 30 0 1 0 28 41" stroke="#5156f5" strokeWidth="9" strokeLinecap="round"/>
      <rect x="349" y="281" width="108" height="7" rx="3" fill="#24344d"/><rect x="349" y="300" width="71" height="7" rx="3" fill="#24344d"/>
      <path d="M44 89H190M44 84V94M190 84V94M196 89H218" stroke="#5156f5" strokeWidth="1"/>
      <path d="M44 184H83M44 180V188M83 180V188" stroke="#5156f5"/>
    </svg>
  </div>;
}

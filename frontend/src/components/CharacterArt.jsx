const COLORS = { rod: '#d89555', net: '#609d91', boat: '#6785a9', yacht: '#2a6ad6', sub: '#3b4a5c', flagship: '#9a3a34', mothership: '#5a3a8a' };
const HAT = { boat: ['#e9e5cf', '#405b6a'], yacht: ['#ffffff', '#2a6ad6'], sub: ['#2b3a4a', '#ffd23f'], flagship: ['#1c2d4f', '#f2c94c'], mothership: ['#3b1f5e', '#ffd23f'] };
const Waves = ({ y = 138, color = '#8fd7ff' }) => <path d={`M4 ${y}q8 -5 16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0`} fill="none" stroke={color} strokeWidth="2.5" opacity=".8" />;

const HULLS = {
  boat: <g><path d="M26 113L81 98 149 112 118 139 58 132Z" fill="#927044" /><path d="M26 106L80 91 149 105 118 130 58 125Z" fill="#c29e69" /><path d="M45 109L82 99 130 108 113 121 62 118Z" fill="#645944" /><path d="M72 109L100 116" stroke="#d1b182" strokeWidth="7" /></g>,
  yacht: <g><rect x="104" y="72" width="48" height="12" rx="2" fill="#f0f0ea" /><rect x="100" y="82" width="54" height="30" fill="#f8f8f4" /><rect x="104" y="88" width="46" height="10" fill="#5ad1ff" /><rect x="146" y="56" width="3" height="18" fill="#9aa4b0" /><rect x="136" y="54" width="22" height="3" fill="#e9eef3" />
    <path d="M12 108L166 108 180 118 158 138 26 138Z" fill="#f8f8f4" /><path d="M18 128L162 128 158 138 26 138Z" fill="#1d3557" /><rect x="14" y="114" width="156" height="4" fill="#2a6ad6" /><path d="M20 110L166 110" stroke="#e9dcc0" strokeWidth="3" /><Waves y="141" /></g>,
  sub: <g><rect x="128" y="86" width="4" height="40" fill="#9aa4b0" /><rect x="126" y="84" width="14" height="5" fill="#9aa4b0" /><rect x="118" y="100" width="3" height="26" fill="#9aa4b0" />
    <rect x="10" y="126" width="160" height="26" rx="13" fill="#3b4a5c" /><rect x="60" y="116" width="56" height="14" rx="3" fill="#2b3745" /><rect x="14" y="140" width="152" height="3" fill="#ffd23f" />
    {[40, 62, 84, 106, 128].map(x => <circle key={x} cx={x} cy="134" r="2.6" fill="#8fd7ff" />)}<Waves y="129" color="#bfeeff" /></g>,
  flagship: <g><rect x="150" y="62" width="11" height="30" fill="#3a4552" /><rect x="150" y="66" width="11" height="5" fill="#d9342b" /><rect x="112" y="70" width="34" height="16" fill="#aab4c0" /><rect x="116" y="74" width="26" height="5" fill="#5ad1ff" /><rect x="106" y="86" width="48" height="32" fill="#8e98a6" />
    <rect x="128" y="40" width="2" height="30" fill="#aab4c0" /><path d="M130 42L150 46 130 50Z" fill="#d9342b" /><path d="M130 45L150 46 130 47Z" fill="#f2c94c" />
    <rect x="22" y="102" width="28" height="16" rx="2" fill="#6b7584" /><rect x="2" y="106" width="22" height="3" fill="#3a4552" /><rect x="2" y="112" width="22" height="3" fill="#3a4552" />
    <path d="M6 118L172 118 180 126 162 148 18 148Z" fill="#7d8795" /><path d="M14 140L164 140 162 148 18 148Z" fill="#5a3a3a" /><rect x="8" y="124" width="166" height="3" fill="#f2c94c" /><Waves y="145" /></g>,
  mothership: <g>{[140, 156].map(x => <g key={x}><rect x={x} y="56" width="11" height="34" fill="#2d1650" /><rect x={x} y="60" width="11" height="5" fill="#f2c94c" /></g>)}<rect x="108" y="68" width="30" height="18" fill="#6a4a9a" /><rect x="112" y="72" width="22" height="5" fill="#ffd23f" /><rect x="102" y="86" width="60" height="32" fill="#5a3a8a" />
    <rect x="124" y="34" width="2" height="34" fill="#f2c94c" /><path d="M126 36L150 41 126 46Z" fill="#8a4bd6" /><path d="M126 40L150 41 126 42Z" fill="#f2c94c" />
    <rect x="18" y="100" width="34" height="18" rx="2" fill="#5a3a8a" /><rect x="0" y="104" width="20" height="3" fill="#2d1650" /><rect x="0" y="111" width="20" height="3" fill="#2d1650" />
    <path d="M2 116L176 116 180 126 164 150 14 150Z" fill="#4a2a7a" /><path d="M10 142L168 142 164 150 14 150Z" fill="#2d1650" /><rect x="4" y="122" width="172" height="3" fill="#f2c94c" /><Waves y="147" color="#c9a6ff" /></g>,
};

export const CharacterArt = ({ type = 'rod', small = false }) => {
  const color = COLORS[type] || COLORS.rod, vessel = type !== 'rod' && type !== 'net', hat = HAT[type];
  return <svg viewBox="0 0 180 155" className={`character-art ${small ? 'small' : ''}`} role="img" aria-label={`${type} fisherman`} data-testid={`character-art-${type}-${small ? 'small' : 'full'}`}>
    <ellipse cx="88" cy="137" rx="57" ry="10" fill="#243f43" opacity=".13" />
    {!vessel && <><path d="M29 126L79 104 144 125 93 149Z" fill="#c0dbd1" /><path d="M29 121L79 99 144 120 93 144Z" fill="#e9f2e8" /></>}
    {type === 'boat' && <><path d="M29 126L79 104 144 125 93 149Z" fill="#c0dbd1" /><path d="M29 121L79 99 144 120 93 144Z" fill="#e9f2e8" /></>}
    {HULLS[type]}
    <path d="M66 100H83V124H61V114H66Z" fill="#3c5658" /><path d="M89 103H105V127H85V118H89Z" fill="#2d4449" />
    <path d="M62 58L97 55 112 65 109 104 75 110 60 99Z" fill={color} /><path d="M97 55L112 65 109 104 96 110Z" fill="#244547" opacity=".25" />
    <path d="M66 60L74 107 87 108 96 58" fill="#e0c38e" /><path d="M68 69L97 66 101 107 72 108Z" fill={color} />
    <path d="M68 25L97 20 110 29 109 60 79 65 67 54Z" fill="#e8bb90" /><path d="M98 26L110 29 109 60 99 64Z" fill="#cc986f" />
    <path d="M63 22L93 16 112 23 115 36 81 43 64 34Z" fill={hat ? hat[0] : color} />
    <path d="M78 12L89 10 97 16 84 20 77 17Z" fill={hat ? hat[1] : '#e6d5a5'} />
    <path d="M67 29L82 36 115 29 115 37 82 45 65 36Z" fill={hat ? hat[1] : '#ecd7b5'} />
    <path d="M76 51L85 55 105 49 105 64 84 70 76 64Z" fill="#e5e0c9" /><path d="M85 48H90V53H85ZM101 44H106V49H101Z" fill="#263b3c" />
    <path d="M92 51L100 50 100 56 92 58Z" fill="#c78d63" />
    <path d="M54 67L66 65 69 89 59 96 51 88Z" fill={color} /><path d="M52 87L62 86 64 96 55 99Z" fill="#e8bb90" />
    <path d="M107 67L117 68 121 85 111 89 105 80Z" fill={color} /><path d="M111 85L124 82 126 90 115 94Z" fill="#e8bb90" />
    {type === 'rod' && <g><path d="M121 93L144 29 151 22" stroke="#786240" strokeWidth="4" fill="none" /><path d="M151 22L159 103" stroke="#799a90" strokeWidth="1" fill="none" /><rect x="156" y="101" width="6" height="5" fill="#d8844c" /></g>}
    {type === 'net' && <g><path d="M121 91L141 53" stroke="#816b47" strokeWidth="4" /><path d="M132 29L156 31 165 48 146 65 128 51Z" fill="#9fc0ac" fillOpacity=".35" stroke="#8d7854" strokeWidth="3" /><path d="M132 35L153 56M137 31L160 50M130 44L143 59M147 31L132 52M156 38L139 60M162 44L146 63" stroke="#739b88" strokeWidth="1.5" /></g>}
    {vessel && type !== 'sub' && <path d="M129 71L146 131 154 136 158 131 149 118 133 70Z" fill="#d4b381" />}
    {type === 'sub' && <g><path d="M12 150q6 -6 12 0M40 152q6 -6 12 0M150 150q6 -6 12 0" stroke="#bfeeff" strokeWidth="2" fill="none" /><circle cx="150" cy="128" r="3" fill="#bfeeff" opacity=".7" /><circle cx="156" cy="120" r="2" fill="#bfeeff" opacity=".6" /></g>}
    {!vessel && <g><path d="M32 107L49 104 56 109 54 129 37 131Z" fill="#819e94" /><path d="M37 108L44 103 52 108" fill="none" stroke="#657f7b" strokeWidth="3" /><path d="M40 112L47 106 48 113" stroke="#e9d69e" strokeWidth="5" /></g>}
  </svg>;
};

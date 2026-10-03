export const projects = [
  {id:'focus',title:'Little Focus',author:'Narin',category:'Productivity',description:'A tiny timer for doing one thing at a time. Start a session, find your rhythm.',image:'assets/focus.jpg',prompt:'Build a minimal focus timer with a 25-minute session, start and pause controls, and a reset button. Keep the screen quiet and the timer easy to read.'},
  {id:'bites',title:'Bangkok Bites',author:'Mali & team',category:'Food & city',description:'Find your next lunch around the neighborhood, without the endless group chat.',image:'assets/bites.jpg',prompt:'Create a small Bangkok lunch finder. Show a list of example meals, filter by category, and let me save a favorite. Clearly label prices and locations as sample data.'},
  {id:'palette',title:'Color Pocket',author:'Pim',category:'Design tool',description:'Make a color pair that feels right. Switch palettes and copy the colors you love.',image:'assets/palette.jpg',prompt:'Build a color-pair explorer with curated palettes, a large preview, a next-palette button, and copyable hex values.'},
  {id:'garden',title:'Pocket Garden',author:'Ton',category:'Tiny game',description:'Take a small break. Visit a pixel town and water its community garden.',image:'assets/garden.jpg',prompt:'Make a tiny garden interaction. Show an original pixel-art town, let visitors water the garden, and acknowledge each action with a clear count. Support keyboard input.'},
  {id:'shelf',title:'Prompt Shelf',author:'Kanya',category:'Developer tool',description:'Keep useful prompts close. Browse a small collection and copy one in a click.',image:'assets/shelf.jpg',prompt:'Make a personal prompt shelf. Show sample writing, coding, and planning prompts. Let me filter by category and copy each prompt.'},
  {id:'trail',title:'Small Steps',author:'Pat & Beam',category:'Daily life',description:'A friendly checklist for the things that make a good day. One step is enough.',image:'assets/trail.jpg',prompt:'Build a simple daily checklist with four example tasks, accessible checkboxes, a completed count, and a reset button. Store changes only in memory.'}
];

export const directions = [
 {id:'town-map',family:'town',name:'Pocket Town · Town Square',short:'Explore the town, one build at a time.',description:'Six clickable project stops turn the original town artwork into a map. A dialogue panel shows your selected build.',tradeoff:'Most playful; you inspect one project at a time.'},
 {id:'town-journal',family:'town',name:'Pocket Town · Town Journal',short:'A quieter record of a shared day.',description:'A lavender town masthead and spacious journal entries put project screenshots, stories, and voting side by side.',tradeoff:'Easiest to read; a longer scroll and less game-like navigation.'},
 {id:'town',name:'Pocket Town',short:'A little world, built together.',description:'An illustrated town square, pixel signposts, and friendly RPG dialogue. The most atmospheric direction.',tradeoff:'Most expressive; artwork takes some space above the projects.',colors:['#dce8c5','#34513e','#8076a2'],dials:'8 / 5 / 4'},
 {id:'lcd',name:'Classic LCD',short:'Four colors. All the character.',description:'A focused olive display with a project selector and a big preview. Pure handheld nostalgia.',tradeoff:'Fast to scan; its deliberately narrow palette feels more restrained.',colors:['#d3dfab','#6f824a','#283c2b'],dials:'6 / 4 / 5'},
 {id:'yellow',name:'Yellow Cartridge',short:'Every build, a collectible.',description:'Bold yellow packaging, blue lettering, and a shelf of project cartridges. Made for a lively showcase.',tradeoff:'Strong event energy; cartridge framing is less compact.',colors:['#f4cf42','#243786','#f8f0d0'],dials:'8 / 5 / 4'},
 {id:'shell',name:'Clear Shell',short:'See what’s inside.',description:'Smoky transparent casing, exposed hardware detail, and bright physical controls. Retro hardware, contemporary UI.',tradeoff:'Most contemporary; its hardware language is subtler than pixel art.',colors:['#c9cdd1','#273334','#d0f468'],dials:'7 / 5 / 4'},
 {id:'index',name:'Trainer Index',short:'Find your next favorite.',description:'A brick-red field guide with a project directory and dedicated detail screen. Browse like a game encyclopedia.',tradeoff:'Best for focused comparison; one project takes center stage at a time.',colors:['#ae4940','#eee6c9','#324c4b'],dials:'7 / 4 / 5'}
];

export const comparisonGroups = [
 {name:'Pocket Town',description:'Keep the town. Choose how to explore it.',ids:['town','town-map','town-journal']},
 {name:'Trainer Index',description:'Keep the field guide. Choose how to browse it.',ids:['index','index-console','index-catalog']}
];

directions.push(
 {id:'index-console',family:'index',name:'Trainer Index · Field Console',short:'One screen. Your next discovery.',description:'A compact red console pairs a wide project screen with six tactile selector keys. The screenshot and vote sit together.',tradeoff:'Most focused; only the selected project is expanded.'},
 {id:'index-catalog',family:'index',name:'Trainer Index · Card Catalog',short:'See the whole collection.',description:'Brick-red framing becomes a catalog of numbered project cards. Large previews let you browse the collection at a glance.',tradeoff:'Best for visual comparison; less of the original handheld silhouette.'}
);

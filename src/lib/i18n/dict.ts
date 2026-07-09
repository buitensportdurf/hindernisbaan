export const dict = {
  nl: {
    'app.title': 'Hindernis kaart',
    'app.subtitle': 'Buitensport Durf',
    'menu.search': 'Zoeken…',
    'menu.design': 'Ontwerp',
    'menu.test': 'Test',
    'menu.test.soon': 'Binnenkort',
    'menu.settings': 'Instellingen',
    'settings.title': 'Instellingen',
    'settings.tiles': 'Kaart',
    'settings.tiles.map': 'Wegenkaart',
    'settings.tiles.map.sub': 'OpenStreetMap',
    'settings.tiles.sat': 'Satelliet',
    'settings.tiles.sat.sub': 'Esri',
    'settings.language': 'Taal',
    'settings.mapdata': 'Kaartgegevens',
    'settings.mapdata.created': 'Aangemaakt',
    'settings.mapdata.count': 'objecten',
    'map.loading': 'Kaart laden…',
    'ls.title': 'localStorage vereist',
    'ls.body':
      'Deze app heeft een browser met localStorage nodig om instellingen en concepten op te slaan. Schakel privémodus uit of gebruik een moderne browser.'
  },
  en: {
    'app.title': 'Obstacle map',
    'app.subtitle': 'Buitensport Durf',
    'menu.search': 'Search…',
    'menu.design': 'Design',
    'menu.test': 'Test',
    'menu.test.soon': 'Soon',
    'menu.settings': 'Settings',
    'settings.title': 'Settings',
    'settings.tiles': 'Map',
    'settings.tiles.map': 'Road map',
    'settings.tiles.map.sub': 'OpenStreetMap',
    'settings.tiles.sat': 'Satellite',
    'settings.tiles.sat.sub': 'Esri',
    'settings.language': 'Language',
    'settings.mapdata': 'Map data',
    'settings.mapdata.created': 'Created',
    'settings.mapdata.count': 'features',
    'map.loading': 'Loading map…',
    'ls.title': 'localStorage required',
    'ls.body':
      'This app needs a browser with localStorage to save settings and drafts. Turn off private mode or use a modern browser.'
  }
} as const;

export type TKey = keyof typeof dict.nl;

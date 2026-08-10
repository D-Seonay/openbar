export interface CocktailRecipe {
  id: string;
  name: string;
  glass?: string;
  tags: string[]; // required ingredient tags (lowercase) for stock matching
  ingredientsList: string[]; // detailed human-readable ingredients with quantities
  instructions: string[]; // step-by-step instructions
  prepTime: string; // e.g., "5 min"
  difficulty: 'Facile' | 'Moyen' | 'Expert';
  description: string;
  isCustom?: boolean;
  createdById?: string;
  createdByUsername?: string;
  vip?: boolean;
}

// Static recipe book with full real instructions, ingredients and metadata.
export const COCKTAILS: CocktailRecipe[] = [
  {
    id: 'mojito',
    name: 'Mojito',
    glass: 'Long drink / Highball',
    tags: ['rhum blanc', 'citron vert', 'menthe', 'sucre', 'soda'],
    ingredientsList: [
      '5 cl de Rhum blanc cubain',
      '8 à 10 feuilles de Menthe fraîche',
      '1/2 Citron vert coupé en quartiers',
      '2 cuillères à café de Sucre blanc en poudre',
      'Eau gazeuse (soda) pour compléter',
      'Glace pilée',
    ],
    instructions: [
      "Placez les quartiers de citron vert, le sucre et les feuilles de menthe au fond d'un grand verre.",
      'Pilez délicatement le tout pour libérer le jus de citron vert et les huiles essentielles de la menthe sans la broyer.',
      'Remplissez le verre à moitié de glace pilée.',
      'Versez le rhum blanc, puis mélangez légèrement.',
      "Remplissez le reste du verre avec de la glace pilée et complétez avec l'eau gazeuse.",
      "Mélangez de bas en haut et décorez d'une tête de menthe.",
    ],
    prepTime: '5 min',
    difficulty: 'Moyen',
    description:
      'Le mythique cocktail cubain, frais, acidulé et parfaitement équilibré. Idéal en toute saison.',
  },
  {
    id: 'cuba-libre',
    name: 'Cuba Libre',
    glass: 'Long drink / Tumbler',
    tags: ['rhum blanc', 'cola', 'citron vert'],
    ingredientsList: [
      '5 cl de Rhum blanc ou ambré',
      '12 cl de Cola',
      '1/2 Citron vert',
      'Glaçons',
    ],
    instructions: [
      'Remplissez un grand verre tumbler de glaçons.',
      "Pressez le jus d'un demi-citron vert directement dans le verre.",
      'Versez le rhum blanc, puis complétez lentement avec le cola frais.',
      'Remuez délicatement une fois et servez.',
    ],
    prepTime: '2 min',
    difficulty: 'Facile',
    description:
      'Un classique indémodable né à La Havane, mêlant la fraîcheur du citron vert au caractère du rhum.',
  },
  {
    id: 'daiquiri',
    name: 'Daiquiri',
    glass: 'Verre à cocktail / Coupe',
    tags: ['rhum blanc', 'citron vert', 'sucre'],
    ingredientsList: [
      '5 cl de Rhum blanc cubain',
      '2.5 cl de Jus de citron vert pressé',
      '1.5 cl de Sirop de sucre de canne',
      'Glaçons',
    ],
    instructions: [
      'Refroidissez votre verre à cocktail en y plaçant des glaçons ou au congélateur.',
      'Dans un shaker, versez le rhum, le jus de citron vert frais et le sirop de sucre.',
      'Remplissez le shaker de glaçons, fermez-le et shakez énergiquement pendant 10 à 15 secondes.',
      'Videz le verre de sa glace et filtrez le mélange dans la coupe refroidie.',
    ],
    prepTime: '3 min',
    difficulty: 'Moyen',
    description:
      'La pureté des saveurs : acidité franche du citron vert, douceur du sucre et arômes du rhum blanc.',
  },
  {
    id: 'pina-colada',
    name: 'Piña Colada',
    glass: 'Verre Hurricane / Long drink',
    tags: ['rhum blanc', 'ananas', 'coco'],
    ingredientsList: [
      '5 cl de Rhum blanc (ou moitié blanc, moitié brun)',
      "10 cl de Jus d'ananas pressé",
      '4 cl de Crème ou lait de coco',
      "1 cl de Jus de citron vert (optionnel pour l'acidité)",
      'Glace pilée',
    ],
    instructions: [
      "Dans un blender ou un shaker, versez le rhum, le jus d'ananas et la crème de coco.",
      'Ajoutez une belle tasse de glace pilée.',
      "Mixez (ou shakez vigoureusement) jusqu'à obtenir une texture onctueuse et mousseuse.",
      "Versez dans un grand verre et décorez d'un triangle d'ananas frais.",
    ],
    prepTime: '4 min',
    difficulty: 'Moyen',
    description:
      "Cocktail onctueux et tropical par excellence. Le mariage parfait de la noix de coco et de l'ananas.",
  },
  {
    id: 'old-fashioned',
    name: 'Old Fashioned',
    glass: 'Verre Old Fashioned / Tumbler bas',
    tags: ['whisky', 'sucre', 'angostura'],
    ingredientsList: [
      '6 cl de Bourbon ou Rye Whisky',
      '1 morceau ou 1 cuillère de Sucre blanc',
      "2 à 3 traits d'Angostura Bitters",
      "1 zeste d'orange",
      'Un grand glaçon',
    ],
    instructions: [
      'Placez le sucre au fond du verre Old Fashioned.',
      "Imbibez-le avec les traits d'Angostura et un trait d'eau ou de whisky.",
      "Écrasez le sucre à l'aide d'un pilon jusqu'à dissolution complète.",
      'Ajoutez un gros glaçon (ou plusieurs) et versez la moitié du whisky. Remuez pendant 15 secondes.',
      "Ajoutez le reste du whisky, remuez de nouveau et exprimez le zeste d'orange au-dessus du verre avant de l'y déposer.",
    ],
    prepTime: '4 min',
    difficulty: 'Expert',
    description:
      'Le roi des cocktails classiques. Un régal boisé et aromatique à déguster lentement au coin du feu.',
  },
  {
    id: 'whisky-coca',
    name: 'Whisky-Coca',
    glass: 'Long drink',
    tags: ['whisky', 'cola'],
    ingredientsList: [
      '5 cl de Blended Whisky',
      '12 cl de Cola frais',
      'Glaçons',
    ],
    instructions: [
      'Remplissez un verre de glaçons.',
      'Versez le whisky.',
      'Complétez avec le cola selon votre goût.',
    ],
    prepTime: '1 min',
    difficulty: 'Facile',
    description:
      'La simplicité même. Idéal pour les fins de soirée sans fioritures.',
  },
  {
    id: 'godfather',
    name: 'Godfather',
    glass: 'Verre Old Fashioned / Tumbler',
    tags: ['whisky', 'amaretto'],
    ingredientsList: [
      '5 cl de Scotch Whisky',
      "2.5 cl de Liqueur d'Amaretto",
      'Glaçons',
    ],
    instructions: [
      'Remplissez un verre de type tumbler de glaçons.',
      "Versez le scotch whisky et l'amaretto.",
      'Remuez délicatement à la cuillère de bar pendant 15 secondes pour rafraîchir le tout.',
    ],
    prepTime: '2 min',
    difficulty: 'Facile',
    description:
      "Un cocktail aromatique et doux, où les notes d'amandes de l'Amaretto arrondissent le caractère du scotch.",
  },
  {
    id: 'gin-tonic',
    name: 'Gin Tonic',
    glass: 'Verre Ballon / Grand verre',
    tags: ['gin', 'tonic', 'citron vert'],
    ingredientsList: [
      '5 cl de Gin',
      '12 cl de Tonic premium',
      '1 ou 2 rondelles de Citron vert (ou concombre/baies)',
      'Glaçons abondants',
    ],
    instructions: [
      "Remplissez votre grand verre de glaçons jusqu'au bord pour éviter une fonte trop rapide.",
      'Versez le gin sur la glace.',
      'Inclinez le verre et versez le tonic doucement pour préserver les bulles.',
      'Exprimez un zeste de citron vert sur le dessus et décorez avec une rondelle.',
    ],
    prepTime: '2 min',
    difficulty: 'Facile',
    description:
      "L'élégance britannique en un verre. Amer, pétillant, et profondément rafraîchissant.",
  },
  {
    id: 'negroni',
    name: 'Negroni',
    glass: 'Verre Old Fashioned / Tumbler',
    tags: ['gin', 'vermouth rouge', 'campari'],
    ingredientsList: [
      '3 cl de Gin',
      '3 cl de Sweet Vermouth rouge',
      '3 cl de Campari (Amer)',
      "1 demi-tranche ou zeste d'Orange",
      'Glaçons',
    ],
    instructions: [
      'Dans un verre rempli de glaçons, versez à parts égales le gin, le vermouth rouge et le Campari.',
      'Remuez avec une cuillère pendant environ 20 secondes pour diluer légèrement et refroidir.',
      "Garnissez d'un zeste ou d'une belle tranche d'orange fraîche.",
    ],
    prepTime: '3 min',
    difficulty: 'Expert',
    description:
      "L'apéritif italien par excellence : un équilibre fascinant entre amertume, douceur et puissance botanique.",
  },
  {
    id: 'martini',
    name: 'Dry Martini',
    glass: 'Verre à Martini / Coupe',
    tags: ['gin', 'vermouth sec'],
    ingredientsList: [
      '6 cl de Gin (ou de Vodka)',
      '1 cl de Vermouth sec (Noilly Prat)',
      '1 Olive verte dénoyautée ou un zeste de citron',
      'Glace',
    ],
    instructions: [
      'Refroidissez votre verre à martini au préalable.',
      'Dans un verre à mélange rempli de glaçons, versez le gin et le vermouth sec.',
      'Remuez délicatement à la cuillère pendant 30 secondes pour refroidir sans casser la glace.',
      'Filtrez le mélange dans le verre refroidi.',
      "Décorez d'une olive sur pique ou exprimez un zeste de citron.",
    ],
    prepTime: '3 min',
    difficulty: 'Expert',
    description:
      'Le cocktail mythique des agents secrets et des esthètes. Sec, glacé, et terriblement sophistiqué.',
  },
  {
    id: 'moscow-mule',
    name: 'Moscow Mule',
    glass: 'Tasse en cuivre / Chope',
    tags: ['vodka', 'ginger beer', 'citron vert'],
    ingredientsList: [
      '5 cl de Vodka',
      '12 cl de Ginger Beer (bière de gingembre piquante)',
      '1.5 cl de Jus de citron vert pressé',
      'Quartier de citron vert et menthe pour décorer',
      'Glace pilée',
    ],
    instructions: [
      'Versez la vodka et le jus de citron vert frais dans la tasse en cuivre remplie de glace pilée.',
      'Complétez avec le ginger beer bien frais.',
      'Remuez brièvement pour harmoniser les températures.',
      "Décorez d'une rondelle de citron vert et éventuellement d'une feuille de menthe.",
    ],
    prepTime: '3 min',
    difficulty: 'Facile',
    description:
      'Un cocktail frais, épicé et désaltérant grâce à la puissance du gingembre et du citron vert.',
  },
  {
    id: 'cosmopolitan',
    name: 'Cosmopolitan',
    glass: 'Verre à Martini',
    tags: ['vodka', 'triple sec', 'citron vert', 'cranberry'],
    ingredientsList: [
      '4 cl de Vodka (citron de préférence)',
      '1.5 cl de Triple Sec (Cointreau)',
      '1.5 cl de Jus de citron vert frais',
      '3 cl de Jus de Cranberry (canneberge)',
      'Glaçons',
    ],
    instructions: [
      'Dans un shaker rempli de glaçons, versez la vodka, le triple sec, le jus de citron vert et le jus de cranberry.',
      'Shakez énergiquement pendant 10 secondes.',
      'Double-filtrez dans le verre à martini préalablement rafraîchi.',
      "Décorez avec un zeste d'orange flambé ou une rondelle de citron.",
    ],
    prepTime: '3 min',
    difficulty: 'Moyen',
    description:
      'Acidulé, fruité et élégant, ce cocktail rose vif est une icône de la culture pop urbaine.',
  },
  {
    id: 'margarita',
    name: 'Margarita',
    glass: 'Verre à Margarita / Coupe givrée',
    tags: ['tequila', 'triple sec', 'citron vert', 'sel'],
    ingredientsList: [
      '5 cl de Tequila 100% agave',
      '3 cl de Triple Sec (Cointreau)',
      '2 cl de Jus de citron vert fraîchement pressé',
      'Sel fin (pour le givrage)',
      'Glaçons',
    ],
    instructions: [
      'Passez un quartier de citron vert sur le bord extérieur du verre, puis trempez-le légèrement dans le sel.',
      'Dans un shaker avec glaçons, versez la tequila, le triple sec et le jus de citron vert pressé.',
      'Shakez vigoureusement pendant 12 secondes.',
      'Filtrez le mélange dans le verre givré contenant quelques glaçons frais (ou sans glace selon préférence).',
    ],
    prepTime: '3 min',
    difficulty: 'Moyen',
    description:
      "Le grand classique mexicain. Un équilibre parfait entre l'agave sauvage, l'acidité et le sel.",
  },
  {
    id: 'tequila-sunrise',
    name: 'Tequila Sunrise',
    glass: 'Long drink / Highball',
    tags: ['tequila', 'orange', 'grenadine'],
    ingredientsList: [
      '5 cl de Tequila',
      "12 cl de Jus d'orange frais",
      '1.5 cl de Sirop de grenadine',
      'Glaçons',
    ],
    instructions: [
      'Remplissez un grand verre de glaçons.',
      "Versez la tequila puis le jus d'orange, mélangez doucement.",
      'Versez lentement le sirop de grenadine le long de la paroi intérieure du verre : il coulera au fond.',
      "Ne mélangez pas avant de servir pour conserver l'effet visuel de dégradé du lever de soleil.",
    ],
    prepTime: '3 min',
    difficulty: 'Facile',
    description:
      "Un cocktail fruité et coloré, célèbre pour son magnifique dégradé évoquant l'aurore.",
  },
  {
    id: 'spritz',
    name: 'Aperol Spritz',
    glass: 'Grand verre ballon',
    tags: ['aperol', 'prosecco', 'soda'],
    ingredientsList: [
      '9 cl de Prosecco (3 parts)',
      "6 cl d'Aperol (2 parts)",
      "3 cl d'Eau gazeuse (1 trait)",
      "1 demi-tranche d'Orange",
      'Glaçons abondants',
    ],
    instructions: [
      "Remplissez le verre ballon de glaçons jusqu'au sommet.",
      "Versez d'abord le prosecco pour éviter que l'Aperol ne stagne au fond.",
      "Ajoutez l'Aperol en mouvement circulaire.",
      "Complétez avec le trait d'eau gazeuse.",
      "Mélangez très délicatement du bas vers le haut et glissez une tranche d'orange dans le verre.",
    ],
    prepTime: '2 min',
    difficulty: 'Facile',
    description:
      'Pétillant, légèrement amer et ensoleillé, le spritz évoque instantanément les terrasses de Venise.',
  },
  {
    id: 'kir-royal',
    name: 'Kir Royal',
    glass: 'Flûte à champagne',
    tags: ['champagne', 'creme de cassis'],
    ingredientsList: [
      '9 cl de Champagne brut frais',
      '1.5 cl de Crème de cassis de Dijon',
    ],
    instructions: [
      'Versez la crème de cassis au fond de la flûte.',
      'Complétez délicatement avec le champagne bien frais, en laissant la mousse redescendre.',
    ],
    prepTime: '2 min',
    difficulty: 'Facile',
    description:
      'Le raffinement français. Idéal pour fêter un grand événement ou accueillir ses convives.',
  },
  {
    id: 'amaretto-sour',
    name: 'Amaretto Sour',
    glass: 'Verre Old Fashioned / Tumbler',
    tags: ['amaretto', 'citron', 'sucre'],
    ingredientsList: [
      "5 cl d'Amaretto",
      '3 cl de Jus de citron pressé',
      '1.5 cl de Sirop de sucre',
      "1.5 cl de Blanc d'œuf (pour la mousse, optionnel)",
      'Glaçons',
    ],
    instructions: [
      "Mettez tous les ingrédients dans le shaker. Si vous utilisez du blanc d'œuf, faites un 'dry shake' (shaker sans glace) pendant 10 secondes.",
      'Ajoutez des glaçons au shaker et shakez énergiquement pendant 10 secondes supplémentaires.',
      'Filtrez dans un verre contenant de gros glaçons.',
      "Décorez d'un zeste de citron ou d'une cerise confite.",
    ],
    prepTime: '4 min',
    difficulty: 'Moyen',
    description:
      'Une merveille douce-amère à la texture veloutée incomparable.',
  },
];

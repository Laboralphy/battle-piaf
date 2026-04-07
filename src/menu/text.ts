const YEAR_FIRST_VERSION = 1996;

function getAge(year: number): number {
    const d = new Date();
    return d.getFullYear() - year;
}

export const MARQUEE_TEXT: string[] = [
    'BATTLE PIAF --- BATTLE PIAF --- BATTLE PIAF --- BATTLE PIAF --- BATTLE PIAF --- BATTLE PIAF ... ... BATTLE PIAF ...',
    'Un jeu qui se joue au clavier, pour deux joueurs avec au moins un bras et une main chacun.  Chaque main doit comporter quelques doigts également, ça peut servir.',
    'But du jeu : Tirez-vous dessus pour gagner des points. Si vous trouvez plus simple comme concept... hé bien gardez le pour vous.',
    "L'histoire, que dis-je, la génèse de ce jeu est fascinante, intrigante, mirobolante, voire même truculante. Je ne sais pas si je vais vous la raconter, genre comme çà... êtes vous au moins prêts pour l'écouter, ou la lire plutôt.",
    'BATTLE PIAF a ' +
        getAge(YEAR_FIRST_VERSION) +
        " ans cette année. Ceux qui y ont joué à l'époque de sa création s'en rapellent encore, et en conserve un souvenir impérissable.  Ils en parlent à leurs enfants au coin du feu, les soirs d'hivers. Repenser à toutes ces parties endiablées leur fait verser une petite larmichette. Nul doute que s'ils le pouvaient, ils se rueraient prestement sur le premier ordi pour y jouer à nouveau, comme au bon vieux temps.",
    "A l'époque, c'était un projet programmé en Turbo Pascal et en assembleur. Des graphismes époustouflants créés avec Deluxe Paint II Enhanced pour PC... Oui : pour PC. L'Amiga n'existait plus à cette époque, car on était en l'an 3 après Doom.",
    "Malheureusement plus personne ne pouvait y jouer jusqu'à récemment... Jusqu'à ce que je livre cette version Typescript qui est une version améliorée d'une autre version Javascript créée en 2010.    Vous suivez ? non ? Pas d'importance. J'écris ce texte en roue libre.",
    'Je vais reprendre du début. Poils au        nez.',
];

# Rimuovi sfondo

Una piccola webapp gratuita per rimuovere lo sfondo da loghi e immagini direttamente nel browser.

## Come si usa

1. Apri un'immagine in formato JPG, PNG o WebP, oppure trascinala nell'area di lavoro. Puoi anche incollare un'immagine dagli appunti con **Ctrl+V**.
2. Scegli il colore da rimuovere usando il selettore, il contagocce oppure **Auto** per stimarlo dai bordi.
3. Regola **Tolleranza** e **Sfumatura** per rifinire il risultato. Attiva l'opzione per rimuovere lo stesso colore anche nelle aree interne se necessario.
4. Controlla i bordi usando l'anteprima a scacchiera, bianca o nera.
5. Premi **Scarica PNG** per esportare l'immagine con trasparenza.

## Elaborazione locale

L'immagine viene elaborata nel browser: non viene caricata su un server per essere modificata e non servono account o servizi esterni di rimozione dello sfondo.

La webapp usa HTML, CSS e JavaScript, senza librerie di elaborazione aggiuntive.

## Limiti

Il metodo funziona meglio con loghi e immagini che hanno uno sfondo abbastanza uniforme. Sfondi complessi, capelli, ombre e soggetti con colori simili allo sfondo possono richiedere regolazioni manuali e non sempre possono essere separati perfettamente.

Le immagini molto grandi vengono ridimensionate automaticamente se superano il limite di elaborazione previsto.

## File del progetto

- `index.html` — struttura dell'interfaccia
- `style.css` — stile e layout
- `script.js` — caricamento, rimozione dello sfondo ed esportazione


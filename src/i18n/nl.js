const nl = {
    meta: {
        locale: 'nl',
        name: 'Nederlands'
    },
    agentStatus: {
        offline: 'Offline',
        ready: 'Beschikbaar',
        busy: 'In Gesprek',
        acw: 'Nabewerkingstijd',
        break: 'Pauze'
    },
    werfsleutelChannels: {
        onlineInternal: 'Online interne sites',
        emailOutbound: 'E-mail outbound',
        telemarketingInbound: 'Telemarketing inbound',
        printOwnTitles: 'Print eigen titels'
    },
    werfsleutel: {
        unknown: 'Onbekende werfsleutel.',
        unknownTitle: 'Onbekende werfsleutel',
        notActive: 'Deze werfsleutel is niet meer actief.',
        unknownChannel: 'Onbekend kanaal',
        channelMismatch: 'Dit kanaal hoort niet bij de gekozen werfsleutel.',
        selectKey: 'Selecteer eerst een actieve werfsleutel.',
        selectChannel: 'Kies een kanaal voor deze werfsleutel.',
        confirmViaSummary: 'Bevestig de werfsleutel via het overzicht.',
        confirmed: 'Werfsleutel bevestigd.'
    },
    common: {
        unknown: 'Onbekend',
        unknownDuration: 'Looptijd onbekend'
    },
    calls: {
        ended: 'Gesprek beëindigd',
        identifiedAs: 'Beller geïdentificeerd als {name}',
        onHold: 'Gesprek in wacht gezet',
        resumed: 'Gesprek hervat (wacht: {duration})',
        startedFromQueue: '📞 Gesprek gestart met {name}',
        completed: 'Gesprek succesvol afgerond',
        simulationStarted: 'Call simulatie gestart: {serviceNumber} (wachttijd: {wait})'
    },
    queue: {
        generated: '✅ Wachtrij gegenereerd met {count} bellers',
        cleared: '✅ Wachtrij gewist',
        empty: '⚠️ Geen bellers in wachtrij',
        activeCallExists: '⚠️ Er is al een actief gesprek',
        mustBeReady: '⚠️ Agent status moet "Beschikbaar" zijn om gesprek te accepteren'
    },
    agent: {
        statusChanged: 'Status gewijzigd naar: {status}',
        cannotSetReadyDuringCall: 'Kan niet naar Beschikbaar tijdens actief gesprek'
    },
    acw: {
        readyForNext: 'Klaar voor volgende gesprek',
        expired: 'ACW tijd verlopen - Status: Beschikbaar',
        completeForm: 'Vul eerst het nabewerkingsscherm in voordat je ACW afrondt'
    },
    disposition: {
        selectCategory: 'Selecteer categorie en uitkomst',
        cancelled: 'Disposition geannuleerd - ACW loopt door'
    },
    customer: {
        notFound: 'Klant niet gevonden',
        updated: 'Klantgegevens succesvol bijgewerkt!',
        selectFirst: 'Selecteer eerst een klant'
    },
    subscription: {
        extraAdded: 'Extra abonnement succesvol toegevoegd!',
        created: 'Nieuw abonnement succesvol aangemaakt!',
        selectOne: 'Selecteer een abonnement',
        selectReason: 'Selecteer een reden',
        selectOffer: 'Selecteer een aanbod',
        notFound: 'Abonnement niet gevonden',
        updated: 'Abonnement succesvol bijgewerkt!',
        noneActive: 'Geen actieve abonnementen gevonden',
        selectAction: 'Selecteer een actie voor {magazine}',
        notFoundOrRefund: 'Abonnement niet gevonden of niet gerestitueerd',
        cancelled: 'Abonnement opgezegd',
        processed: '{count} abonnement(en) verwerkt. Bevestigingen worden verstuurd.',
        transferred: '{magazine} overgezet naar {name}'
    },
    resend: {
        editionResent: 'Editie van {magazine} wordt opnieuw verzonden!'
    },
    editorial: {
        registered: '{typeLabel} voor redactie geregistreerd!'
    },
    forms: {
        required: 'Vul alle verplichte velden in',
        invalidEmail: 'Voer een geldig e-mailadres in',
        newSubscriberRequired: 'Vul alle verplichte velden in voor de nieuwe abonnee',
        newSubscriberInvalidEmail: 'Voer een geldig e-mailadres in voor de nieuwe abonnee',
        newSubscriberAddressMissing: 'Vul alle adresvelden in voor de nieuwe abonnee',
        refundEmailMissing: 'Voer een e-mailadres in voor de restitutiebevestiging',
        refundEmailInvalid: 'Voer een geldig e-mailadres in voor de restitutie',
        descriptionRequired: 'Voer een beschrijving in',
        selectMagazine: 'Selecteer een magazine'
    },
    winback: {
        selectOutcome: 'Selecteer een resultaat',
        success: 'Winback succesvol! Klant blijft abonnee.'
    },
    articleOrders: {
        addItem: 'Voeg minimaal één artikel toe aan de bestelling',
        created: 'Artikel bestelling succesvol aangemaakt!',
        createdWithCustomer: 'Nieuwe klant en artikel bestelling succesvol aangemaakt!'
    },
    delivery: {
        remarksSaved: 'Bezorgvoorkeuren opgeslagen!',
        holidays: [
            { name: 'Nieuwjaarsdag', date: '01-01' },
            { name: 'Koningsdag', date: '04-27' },
            { name: 'Bevrijdingsdag', date: '05-05', everyFiveYears: true },
            { name: 'Eerste Kerstdag', date: '12-25' },
            { name: 'Tweede Kerstdag', date: '12-26' }
        ],
        dayNames: ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'],
        dayNamesShort: ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'],
        monthNames: [
            'januari',
            'februari',
            'maart',
            'april',
            'mei',
            'juni',
            'juli',
            'augustus',
            'september',
            'oktober',
            'november',
            'december'
        ]
    },
    articleSearch: {
        noResults: 'Geen artikelen gevonden.',
        browseAllCta: 'Blader door alle artikelen →',
        browseAll: '📚 Blader door alle artikelen',
        modalTitle: '📚 Alle Artikelen',
        searchPlaceholder: 'Zoek artikel...',
        tabAll: 'Alle',
        tabPopular: 'Populair',
        tabAvrobode: 'Avrobode',
        tabMikrogids: 'Mikrogids',
        tabNcrvgids: 'Ncrvgids',
        emptyState: 'Geen artikelen gevonden'
    },
    storage: {
        cleared: 'Lokale opslag gewist. Pagina wordt herladen...'
    }
};

export default nl;

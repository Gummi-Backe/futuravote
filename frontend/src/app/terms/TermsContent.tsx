"use client";

export function TermsContent() {
  return (
    <>
      <h1 className="text-2xl font-bold text-white">Nutzungsbedingungen für Future-Vote</h1>

      <p className="mt-2 text-sm text-slate-300">
        Diese Nutzungsbedingungen regeln die Nutzung der Plattform <span className="font-semibold">Future-Vote</span>{" "}
        (nachfolgend „Plattform“). Mit der Nutzung der Plattform erklärst du dich mit diesen Bedingungen einverstanden.
      </p>

      <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-200">
        <section>
          <h2 className="text-base font-semibold text-white">1. Anbieter</h2>
          <p className="mt-1">
            Angaben zum Anbieter findest du im{" "}
            <a href="/impressum" className="font-semibold text-emerald-100 hover:text-emerald-50">
              Impressum
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">2. Zweck der Plattform</h2>
          <p className="mt-1">
            Future-Vote ist eine Community-Plattform für Prognosen und Meinungsumfragen. Nutzerinnen und Nutzer können
            abstimmen, Inhalte melden und (mit Konto) eigene Fragen vorschlagen. Öffentliche Fragen sind im Feed sichtbar.
            Private Umfragen sind nur über einen Link erreichbar.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">3. Nutzung ohne Login</h2>
          <p className="mt-1">
            Bestimmte Funktionen (z. B. Abstimmen oder Reviews) sind ohne Login möglich. Dafür nutzt die Plattform
            technische Kennungen (z. B. Cookies), um Mehrfachabstimmungen zu verhindern und deinen Abstimmungsstatus
            anzuzeigen. Wenn du Website-Daten löschst oder den Browser wechselst, kann dieser Status verloren gehen.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">4. Registrierung und Konto</h2>
          <p className="mt-1">
            Für das Einreichen neuer Fragen (Drafts) sowie für Kommentare, Favoriten und Profilfunktionen ist ein Konto
            erforderlich. Du verpflichtest dich, bei der Registrierung korrekte Angaben zu machen und deine Zugangsdaten
            vertraulich zu behandeln. Du bist dafür verantwortlich, was über deinen Account auf der Plattform passiert.
          </p>
          <p className="mt-1">Bestimmte Aktionen können eine verifizierte E-Mail-Adresse erfordern.</p>
          <p className="mt-1">
            Du kannst dein Konto jederzeit in deinem Profil unter <span className="font-semibold">„Account löschen“</span> löschen. Dabei
            werden personenbezogene Kontodaten entfernt; öffentliche Inhalte (z. B. Fragen oder Abstimmungen) können anonymisiert bestehen
            bleiben.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">5. Inhalte der Nutzerinnen und Nutzer</h2>
          <p className="mt-1">
            Nutzerinnen und Nutzer können Inhalte einstellen (z. B. Fragen, Beschreibungen, Kommentare, Quellenlinks und
            Bilder). Du bist allein dafür verantwortlich, dass deine Inhalte rechtmäßig sind und keine Rechte Dritter
            verletzen.
          </p>
          <p className="mt-1">
            Mit dem Einstellen von Inhalten räumst du der Plattform eine einfache, zeitlich und räumlich unbeschränkte,
            unentgeltliche Lizenz ein, diese Inhalte im Rahmen des Angebots zu speichern, technisch zu verarbeiten,
            darzustellen und öffentlich zugänglich zu machen (bei privaten Umfragen: nur für Personen mit dem Link).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">6. Bilder &amp; Urheberrechte</h2>
          <p className="mt-1">
            Wenn du Bilder hochlädst oder verlinkst, versicherst du, dass du alle erforderlichen Nutzungsrechte besitzt
            und keine Urheberrechte, Markenrechte, Persönlichkeitsrechte oder sonstigen Rechte Dritter verletzt werden.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Nur eigene Bilder oder Bilder mit entsprechender Lizenz verwenden.</li>
            <li>Keine Bilder aus dem Internet verwenden, für die keine Erlaubnis oder Lizenz vorliegt.</li>
            <li>Rechte abgebildeter Personen respektieren (z. B. keine unerlaubten Fotos von Dritten).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">7. Private Umfragen (nur per Link)</h2>
          <p className="mt-1">
            Private Umfragen erscheinen nicht im öffentlichen Feed. Jeder, der den Link kennt, kann auf die Umfrage
            zugreifen. Du bist dafür verantwortlich, mit wem du den Link teilst. Ein absoluter Schutz vor Weitergabe des
            Links kann nicht garantiert werden.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">8. Verbotene Inhalte</h2>
          <p className="mt-1">Es ist insbesondere untersagt, Inhalte zu veröffentlichen, die:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>gegen geltendes Recht verstoßen,</li>
            <li>Hass, Gewalt oder Diskriminierung fördern,</li>
            <li>pornografisch oder jugendgefährdend sind,</li>
            <li>personenbezogene Daten Dritter ohne deren Einwilligung enthalten,</li>
            <li>Spam oder irrelevante Werbung darstellen.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">9. Moderation, Meldungen und Maßnahmen</h2>
          <p className="mt-1">
            Nutzerinnen und Nutzer können Inhalte melden. Der Betreiber kann Inhalte ganz oder teilweise entfernen,
            Inhalte vorübergehend ausblenden, Accounts temporär oder dauerhaft sperren und andere geeignete Maßnahmen
            ergreifen, wenn Hinweise auf Rechtsverstöße oder Verstöße gegen diese Nutzungsbedingungen vorliegen. Ein
            Anspruch auf Veröffentlichung oder dauerhafte Verfügbarkeit von Inhalten besteht nicht.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">10. Auflösung von Fragen / Ergebnisdarstellung</h2>
          <p className="mt-1">
            Öffentliche Fragen haben eine Deadline und Auflösungsregeln. Nach Ablauf kann das tatsächliche Ergebnis
            (Ja/Nein) inklusive Quelle oder Notiz im Archiv angezeigt werden. Zur Unterstützung können automatisierte
            Systeme (z. B. KI) Quellen vorschlagen; die finale Entscheidung über die Eintragung des Ergebnisses liegt
            beim Betreiber.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">11. Keine Gewähr für Inhalte und Prognosen</h2>
          <p className="mt-1">
            Fragen, Prognosen, Kommentare und Auswertungen stammen überwiegend von der Community. Sie stellen keine
            fachliche Beratung dar. Der Betreiber übernimmt keine Gewähr für Richtigkeit, Vollständigkeit oder
            Aktualität der Inhalte.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">12. Verfügbarkeit</h2>
          <p className="mt-1">
            Der Betreiber bemüht sich um eine hohe Verfügbarkeit der Plattform. Wartungsarbeiten, Weiterentwicklungen
            oder Störungen können zu Einschränkungen oder Unterbrechungen führen.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">13. Haftung</h2>
          <p className="mt-1">
            Der Betreiber haftet für Schäden nur bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung wesentlicher
            Vertragspflichten. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den
            vorhersehbaren, vertragstypischen Schaden begrenzt. Für von Nutzerinnen und Nutzern eingestellte Inhalte gilt
            die Haftung nach den gesetzlichen Vorschriften, insbesondere ab Kenntnis eines konkreten Rechtsverstoßes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">14. Änderungen</h2>
          <p className="mt-1">
            Der Funktionsumfang der Plattform kann sich weiterentwickeln. Der Betreiber kann diese Nutzungsbedingungen
            anpassen. Wesentliche Änderungen werden in geeigneter Form bekannt gegeben.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">15. Schlussbestimmungen</h2>
          <p className="mt-1">
            Es gilt deutsches Recht. Gerichtsstand ist – soweit zulässig – der Sitz des Betreibers. Sollte eine
            Bestimmung dieser Nutzungsbedingungen unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen
            Bestimmungen unberührt.
          </p>
          <p className="mt-2 text-xs text-slate-400">Stand: Dezember 2025</p>
        </section>
      </div>
    </>
  );
}

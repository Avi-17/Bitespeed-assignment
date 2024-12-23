const {
  getRecordsByEmailorPhone,
  createRecord,
  updateRecordUsingId,
  updateRecordUsingLinkedId,
  getRecordsByEmailandPhone,
  getContactsByLinkedId,
  getMailsfromContact,
  getPhonesfromContact,
} = require("../models/contactModel");

const identifyContact = async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res
      .status(400)
      .json({ error: "Either email or phoneNumber is required." });
  }

  try {
    const orExistingContacts = await getRecordsByEmailorPhone(
      email,
      phoneNumber
    );
    const andExistingContacts = await getRecordsByEmailandPhone(
      email,
      phoneNumber
    );

    const allEmails = await getMailsfromContact(email);
    const allPhones = await getPhonesfromContact(phoneNumber);

    if (orExistingContacts.length === 0) {
      const newEntryId = await createRecord(email, phoneNumber);
      return res.status(201).json({
        contact: {
          primaryContactId: newEntryId,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: [],
        },
      });
    }

    if (andExistingContacts.length === 0) {
      let primary = orExistingContacts[0];
      let primaryId = primary.linkedId ? primary.linkedId : primary.id;

      if(allEmails.length === 0 || allPhones.length === 0){
        await createRecord(email, phoneNumber, primaryId, "secondary");
      }
      
    }

    let primaryIds = new Set();
    for (let i = 0; i < orExistingContacts.length; i++) {
      if (orExistingContacts[i].linkedId) {
        primaryIds.add(orExistingContacts[i].linkedId);
      } else {
        primaryIds.add(orExistingContacts[i].id);
      }
    }

    let primaries = [...primaryIds];
    primaries.sort((a, b) => a - b);
    const persistentPrimaryId = primaries[0];
    const imposterPrimaryId = primaries[1];

    if (persistentPrimaryId && imposterPrimaryId) {
      await updateRecordUsingId(imposterPrimaryId, {
        linkedId: persistentPrimaryId,
        linkPrecedence: "secondary",
      });
      await updateRecordUsingLinkedId(imposterPrimaryId, {
        linkedId: persistentPrimaryId,
      });

      const resEmails = new Set();
      const resPhoneNumbers = new Set();
      const resSecondaryContactIds = [];

      const allRecords = await getContactsByLinkedId(persistentPrimaryId);

      allRecords.forEach((contact) => {
        if (contact.email) resEmails.add(contact.email);
        if (contact.phoneNumber) resPhoneNumbers.add(contact.phoneNumber);
        if (contact.linkPrecedence === "secondary") {
          resSecondaryContactIds.push(contact.id);
        }
      });

      res.status(200).json({
        contact: {
          primaryContactId: persistentPrimaryId,
          emails: [...resEmails],
          phoneNumbers: [...resPhoneNumbers],
          secondaryContactIds: resSecondaryContactIds,
        },
      });
    } else {
      const resEmails = new Set();
      const resPhoneNumbers = new Set();
      const resSecondaryContactIds = [];

      const allRecords = await getContactsByLinkedId(persistentPrimaryId);

      allRecords.forEach((contact) => {
        if (contact.email) resEmails.add(contact.email);
        if (contact.phoneNumber) resPhoneNumbers.add(contact.phoneNumber);
        if (contact.linkPrecedence === "secondary") {
          resSecondaryContactIds.push(contact.id);
        }
      });

      res.status(200).json({
        contact: {
          primaryContactId: persistentPrimaryId,
          emails: [...resEmails],
          phoneNumbers: [...resPhoneNumbers],
          secondaryContactIds: resSecondaryContactIds,
        },
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error." });
  }
};

module.exports = identifyContact;

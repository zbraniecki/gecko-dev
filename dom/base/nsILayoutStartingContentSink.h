/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef nsILayoutStartingContentSink_h___
#define nsILayoutStartingContentSink_h___

/**
 * An interface for a content sink that can start layout of a document.  This
 * interface allows some control over whether layout will get started.
 */
#include "nsISupports.h"

#define NS_ILAYOUT_STARTING_CONTENT_SINK_IID \
{ 0x6b6e2f61, 0x136f, 0x48f1, \
 { 0xa1, 0x26, 0x4b, 0x08, 0x67, 0xd3, 0x51, 0x38 } }

class nsILayoutStartingContentSink : public nsISupports {
public:

  NS_DECLARE_STATIC_IID_ACCESSOR(NS_ILAYOUT_STARTING_CONTENT_SINK_IID)

  /**
   * Block layout start (unless forced) at least until
   * RemoveLayoutStartBlocker() is called.  Multiple calls will require multiple
   * RemoveLayoutStartBlocker() calls to undo.
   */
  virtual void AddLayoutStartBlocker() = 0;

  /**
   * Unblock layout, undoing one AddLayoutStartBlocker() call.
   */
  virtual void RemoveLayoutStartBlocker() = 0;
};

NS_DEFINE_STATIC_IID_ACCESSOR(nsILayoutStartingContentSink,
			      NS_ILAYOUT_STARTING_CONTENT_SINK_IID)

#endif /* nsILayoutStartingContentSink_h___ */
